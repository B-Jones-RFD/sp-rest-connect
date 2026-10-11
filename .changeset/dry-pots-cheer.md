---
'@b-jones-rfd/sp-rest-connect': minor
---

Add `queryListItems` (CAML queries via `GetItems`, for lists above the 5,000-item view threshold, with `pagingInfo` support), `batch` (several REST calls in one `/_api/$batch` round trip on SharePoint 2016+, consecutive writes grouped into a changeset, one `BatchResponse` per request), and `Retry-After` handling: `Failure.retryAfterMs` carries the server's requested wait, and the retry logic honours it — or stops early when it exceeds `maxDelayMs`. `parseRetryAfter` is exported. New types: `QueryListItemsOptions`, `BatchOptions`, `BatchRequest`, `BatchResponse`, `BatchMethod`, `ItemsAction`, `ItemsActionFactory`.
