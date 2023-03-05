export type Success<T> = { success: true; data: T }

export type Failure = { success: false; error: string }

export type Result<T> = Success<T> | Failure

export type Action<TParams, TResponse> = (
  options: TParams
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

export type SiteConnection = (options: SiteConnectionOptions) => {
  addAttachmentToListItem: Action<
    {
      accessToken: string
      listName: string
      spId: number
      fileName: string
      payload: Buffer
    },
    string
  >
  addDocumentToLibrary: Action<
    { accessToken: string; folder: string; fileName: string; payload: Buffer },
    string
  >
  addListItem: Action<
    { accessToken: string; listName: string; spId: number; payload: string },
    string
  >
  deleteDocumentFromLibrary: Action<
    {
      accessToken: string
      folder: string
      fileName: string
    },
    string
  >
  deleteListItem: Action<
    {
      accessToken: string
      listName: string
      spId: number
    },
    string
  >
  getAuthToken: Action<void, string>
  getDocumentFromLibrary: Action<{ folder: string; fileName: string }, string>
  getFolderContents: Action<{ folder: string }, unknown[]>
  getListContents: Action<
    { listName: string; params?: URLSearchParams },
    unknown[]
  >
  getListItem: Action<{ listName: string; spId: number }, unknown>
  updateListItem: Action<
    {
      accessToken: string
      listName: string
      spId: number
      patch: string
    },
    string
  >
}