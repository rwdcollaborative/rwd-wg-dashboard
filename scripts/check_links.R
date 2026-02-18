#!/usr/bin/env Rscript

suppressPackageStartupMessages({
  library(googlesheets4)
  library(httr2)
  library(cellranger)
})

sheet_id <- Sys.getenv("RWD_SHEET_ID", "1L8VTkbA0bsEYAceLyYebYPxwETYyF2jzdvoCuqibE-s")
sheet_name <- Sys.getenv("RWD_SHEET_NAME", "Inventory")
header_row <- 2L
data_start_row <- header_row + 1L

meta_cols <- c("Meta URL Status", "Meta URL Checked At", "Meta URL Check Detail")

service_json <- Sys.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
service_path <- Sys.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

if (!nzchar(service_path) && nzchar(service_json)) {
  service_path <- tempfile(fileext = ".json")
  writeLines(service_json, service_path)
}

if (!nzchar(service_path)) {
  stop("Missing service account credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.")
}

gs4_auth(
  path = service_path,
  scopes = "https://www.googleapis.com/auth/spreadsheets"
)

extract_urls <- function(x) {
  if (is.null(x) || is.na(x) || !nzchar(trimws(x))) return(character(0))
  found <- unlist(regmatches(x, gregexpr("https?://[^[:space:]\"]+", x, perl = TRUE)))
  found <- gsub("[),.;]+$", "", found)
  unique(found[nzchar(found)])
}

is_ipv4_literal <- function(host) {
  grepl("^[0-9]{1,3}(\\.[0-9]{1,3}){3}$", host)
}

is_private_ipv4 <- function(host) {
  parts <- as.integer(strsplit(host, ".", fixed = TRUE)[[1]])
  if (length(parts) != 4 || any(is.na(parts)) || any(parts < 0 | parts > 255)) return(FALSE)
  if (parts[1] == 10) return(TRUE)
  if (parts[1] == 127) return(TRUE)
  if (parts[1] == 0) return(TRUE)
  if (parts[1] == 169 && parts[2] == 254) return(TRUE)
  if (parts[1] == 172 && parts[2] >= 16 && parts[2] <= 31) return(TRUE)
  if (parts[1] == 192 && parts[2] == 168) return(TRUE)
  FALSE
}

blocked_target_reason <- function(url) {
  parsed <- tryCatch(url_parse(url), error = function(e) NULL)
  if (is.null(parsed)) return("invalid_url")

  scheme <- tolower(if (is.null(parsed$scheme)) "" else parsed$scheme)
  host <- tolower(if (is.null(parsed$hostname)) "" else parsed$hostname)
  if (!(scheme %in% c("http", "https"))) return("blocked_scheme")
  if (!nzchar(host)) return("missing_host")
  if (host == "localhost") return("localhost")
  if (grepl("\\.local$", host) || grepl("\\.internal$", host)) return("internal_hostname")
  if (is_ipv4_literal(host) && is_private_ipv4(host)) return("private_ipv4")
  ""
}

check_one_url <- function(url) {
  blocked_reason <- blocked_target_reason(url)
  if (nzchar(blocked_reason)) {
    return(list(
      ok = FALSE,
      code = 451L,
      effective = url,
      error = paste0("BLOCKED_TARGET(", blocked_reason, ")")
    ))
  }

  probe <- function(method) {
    req <- request(url) |>
      req_method(method) |>
      req_options(timeout = 20) |>
      req_error(is_error = function(resp) FALSE)
    resp <- req_perform(req)
    list(
      ok = TRUE,
      code = resp_status(resp),
      effective = if (!is.null(resp$url) && nzchar(resp$url)) resp$url else url,
      error = NA_character_
    )
  }

  head_out <- tryCatch(probe("HEAD"), error = function(e) NULL)

  # Many sites block or mishandle HEAD; retry with GET when HEAD is missing or non-2xx/3xx.
  if (is.null(head_out) || is.na(head_out$code) || head_out$code >= 400L) {
    get_out <- tryCatch(probe("GET"), error = function(e) {
      list(ok = FALSE, code = NA_integer_, effective = url, error = conditionMessage(e))
    })
    return(get_out)
  }

  head_out
}

summarize_row <- function(urls) {
  if (length(urls) == 0) {
    return(list(status = "unknown", detail = "No URL provided"))
  }

  checks <- lapply(urls, check_one_url)
  codes <- vapply(checks, function(x) ifelse(is.null(x$code), NA_integer_, x$code), integer(1))
  ok <- which(!is.na(codes) & codes >= 200 & codes < 400)
  dead <- which(!is.na(codes) & codes %in% c(404L, 410L))
  warn <- which(!is.na(codes) & codes >= 400L & !(codes %in% c(404L, 410L)))
  unknown <- which(is.na(codes))

  status <- if (length(dead) > 0 && length(ok) == 0 && length(warn) == 0 && length(unknown) == 0) {
    "dead"
  } else if (length(ok) > 0 && length(dead) == 0 && length(warn) == 0 && length(unknown) == 0) {
    "ok"
  } else {
    # Any non-clean result with provided URLs is a warning (timeouts, DNS failures, mixed outcomes, etc.).
    "warn"
  }

  detail_parts <- vapply(seq_along(urls), function(i) {
    code <- checks[[i]]$code
    err <- checks[[i]]$error
    code_txt <- ifelse(is.na(code), "ERR", as.character(code))
    if (!is.na(err) && nzchar(err)) {
      paste0(code_txt, " ", urls[[i]], " [", err, "]")
    } else {
      paste0(code_txt, " ", urls[[i]])
    }
  }, character(1))

  detail <- paste0(length(ok), "/", length(urls), " ok; ", paste(detail_parts, collapse = " | "))
  if (nchar(detail) > 480) detail <- paste0(substr(detail, 1, 477), "...")

  list(status = status, detail = detail)
}

to_col_letter <- function(n) {
  letters_out <- character(0)
  while (n > 0) {
    rem <- (n - 1) %% 26
    letters_out <- c(LETTERS[rem + 1], letters_out)
    n <- (n - rem - 1) %/% 26
  }
  paste0(letters_out, collapse = "")
}

header <- read_sheet(
  ss = sheet_id,
  sheet = sheet_name,
  range = sprintf("%d:%d", header_row, header_row),
  col_names = FALSE
)
header_vals <- trimws(as.character(header[1, ]))
header_vals[is.na(header_vals)] <- ""

for (meta_name in meta_cols) {
  if (!(meta_name %in% header_vals)) {
    first_blank <- which(header_vals == "")[1]
    target_col <- if (!is.na(first_blank)) first_blank else (length(header_vals) + 1)
    target_cell <- sprintf("%s%d", to_col_letter(target_col), header_row)
    range_write(
      ss = sheet_id,
      sheet = sheet_name,
      data = data.frame(value = meta_name),
      range = target_cell,
      col_names = FALSE,
      reformat = FALSE
    )
    if (target_col > length(header_vals)) {
      header_vals[target_col] <- meta_name
    } else {
      header_vals[target_col] <- meta_name
    }
  }
}

data_raw <- read_sheet(ss = sheet_id, sheet = sheet_name, skip = 1)
names(data_raw) <- trimws(names(data_raw))

if (!"Title" %in% names(data_raw) || !"URL(s)" %in% names(data_raw)) {
  stop("Expected columns 'Title' and 'URL(s)' were not found.")
}

for (meta_name in meta_cols) {
  if (!meta_name %in% names(data_raw)) data_raw[[meta_name]] <- ""
}

titles <- trimws(as.character(data_raw$Title))
titles[is.na(titles)] <- ""
urls_col <- as.character(data_raw$`URL(s)`)
urls_col[is.na(urls_col)] <- ""

status_out <- as.character(data_raw$`Meta URL Status`)
checked_out <- as.character(data_raw$`Meta URL Checked At`)
detail_out <- as.character(data_raw$`Meta URL Check Detail`)

status_out[is.na(status_out)] <- ""
checked_out[is.na(checked_out)] <- ""
detail_out[is.na(detail_out)] <- ""

checked_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
title_rows <- which(nzchar(titles))

for (i in title_rows) {
  urls <- extract_urls(urls_col[[i]])
  result <- summarize_row(urls)
  status_out[[i]] <- result$status
  checked_out[[i]] <- checked_at
  detail_out[[i]] <- result$detail
}

write_meta_column <- function(column_name, values) {
  col_idx <- match(column_name, names(data_raw))
  if (is.na(col_idx)) stop(sprintf("Could not locate column: %s", column_name))
  end_row <- data_start_row + length(values) - 1L
  target_range <- cell_limits(c(data_start_row, col_idx), c(end_row, col_idx))
  range_write(
    ss = sheet_id,
    sheet = sheet_name,
    data = data.frame(value = values),
    range = target_range,
    col_names = FALSE,
    reformat = FALSE
  )
}

write_meta_column("Meta URL Status", status_out)
write_meta_column("Meta URL Checked At", checked_out)
write_meta_column("Meta URL Check Detail", detail_out)

cat("URL check complete.\n")
cat("Rows with titles:", length(title_rows), "\n")
cat("Dead:", sum(status_out[title_rows] == "dead", na.rm = TRUE), "\n")
cat("Warn:", sum(status_out[title_rows] == "warn", na.rm = TRUE), "\n")
cat("OK:", sum(status_out[title_rows] == "ok", na.rm = TRUE), "\n")
cat("Unknown:", sum(status_out[title_rows] == "unknown", na.rm = TRUE), "\n")
