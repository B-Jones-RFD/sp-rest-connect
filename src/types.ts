export type Success<T> = { success: true; data: T }

export type Failure = { success: false; error: string }

export type Result<T> = Success<T> | Failure

export type Action<TConfig, TResponse> = (
  options: TConfig
) => Promise<Result<TResponse>>

export type SiteConnectionOptions = {
  username: string
  password: string
  site: string
  serverRelativeUrl: string
  protocol?: 'https' | 'http'
  domain?: string | ''
  hostname?: string
}

export type ActionFactory<TParams, TResponse> = (
  options: SiteConnectionOptions
) => Action<TParams, TResponse>

export type SiteConnection = {
  addAttachmentToListItem: Action<
    {
      accessToken: string
      listName: string
      spId: number
      fileName: string
      payload: Buffer
      timeout?: number
      binary?: boolean
    },
    string
  >
  addDocumentToLibrary: Action<
    {
      accessToken: string
      folder: string
      fileName: string
      payload: Buffer
      timeout?: number
      binary?: boolean
    },
    string
  >
  addListItem: Action<
    {
      accessToken: string
      listName: string
      payload: string
      timeout?: number
      binary?: boolean
    },
    string
  >
  checkFolderExistsInLibrary: Action<{ folder: string }, boolean>
  createFolderInLibrary: Action<
    { accessToken: string; folder: string; timeout?: number; binary?: boolean },
    string
  >
  deleteDocumentFromLibrary: Action<
    {
      accessToken: string
      folder: string
      fileName: string
      timeout?: number
      binary?: boolean
    },
    string
  >
  deleteListItem: Action<
    {
      accessToken: string
      listName: string
      spId: number
      timeout?: number
      binary?: boolean
    },
    string
  >
  getAuthToken: Action<{ timeout?: number; binary?: boolean }, string>
  getDocumentFromLibrary: Action<
    { folder: string; fileName: string; timeout?: number; binary?: boolean },
    Buffer
  >
  getFolderContents: Action<
    {
      folder: string
      params?: URLSearchParams
      timeout?: number
      binary?: boolean
    },
    unknown[]
  >
  getFormDigestValue: Action<{ timeout?: number; binary?: boolean }, string>
  getListContents: Action<
    {
      listName: string
      params?: URLSearchParams
      timeout?: number
      binary?: boolean
    },
    unknown[]
  >
  getListItem: Action<
    { listName: string; spId: number; timeout?: number; binary?: boolean },
    unknown
  >
  getListItemType: Action<
    { listName: string; timeout?: number; binary?: boolean },
    string
  >
  updateListItem: Action<
    {
      accessToken: string
      listName: string
      spId: number
      patch: string
      timeout?: number
      binary?: boolean
    },
    string
  >
}

export type SiteConnectionFactory = (
  options: SiteConnectionOptions
) => SiteConnection
