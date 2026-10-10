---
'@b-jones-rfd/sp-rest-connect': major
---

folder is now resolved relative to serverRelativeUrl in addDocumentToLibrary, checkFolderExistsInLibrary and createFolderInLibrary, matching the other folder methods and the README. Callers that passed a full server-relative path to these three methods must drop the site prefix.
