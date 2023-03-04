export type ConnectionOptions = {
  username: string
  password: string
  site: string
  serverRelativeUrl: string
  protocol?: 'https' | 'http'
  domain?: string | ''
  hostname?: string
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export type Action<TParams, TResult> = (options: TParams) => TResult

export type ActionFactory<TParams, TResult> = (
  options: ConnectionOptions
) => Action<TParams, TResult>

export type Connection = (options: ConnectionOptions) => {
  addAttachmentToListItem: Action<
    {
      accessToken: string
      listName: string
      spId: number
      fileName: string
      payload: Buffer
    },
    Promise<Result<string>>
  >
  addDocumentToLibrary: Action<
    { accessToken: string; folder: string; fileName: string; payload: Buffer },
    Promise<Result<string>>
  >
  addListItem: Action<
    { accessToken: string; listName: string; spId: number; payload: string },
    Promise<Result<string>>
  >
  deleteDocumentFromLibrary: Action<
    {
      accessToken: string
      folder: string
      fileName: string
    },
    Promise<Result<string>>
  >
  deleteListItem: Action<
    {
      accessToken: string
      listName: string
      spId: number
    },
    Promise<Result<string>>
  >
  getAuthToken: Action<void, Promise<Result<string>>>
  getDocumentFromLibrary: Action<
    { folder: string; fileName: string },
    Promise<Result<string>>
  >
  getFolderContents: Action<{ folder: string }, Promise<Result<unknown[]>>>
  getListContents: Action<
    { listName: string; params?: URLSearchParams },
    Promise<Result<unknown[]>>
  >
  getListItem: Action<
    { listName: string; spId: number },
    Promise<Result<unknown>>
  >
  updateListItem: Action<
    {
      accessToken: string
      listName: string
      spId: number
      patch: string
    },
    Promise<Result<string>>
  >
}
