export const resultSuccess = (data: unknown) => ({ success: true, data })

export const resultFailure = (error: string) => ({ success: false, error })

export const formatError = resultFailure('Incorrect response format')
