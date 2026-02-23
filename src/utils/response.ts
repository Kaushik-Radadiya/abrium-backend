import type { Response } from 'express'

type ResponseBody<T = unknown> = {
  error: boolean
  success: boolean
  message: string
  statusCode: number
  data: T | null
}

export function successResponse<T>(
  res: Response,
  message = 'Success',
  statusCode = 200,
  data: T | null = null
) {
  return res.status(statusCode).send({
    error: false,
    success: true,
    message,
    statusCode,
    data,
  } satisfies ResponseBody<T>)
}

export function failResponse<T>(
  res: Response,
  message = 'Request failed',
  statusCode = 400,
  data: T | null = null
) {
  return res.status(statusCode).send({
    error: false,
    success: false,
    message,
    statusCode,
    data,
  } satisfies ResponseBody<T>)
}

export function errorResponse(
  res: Response,
  errorDesc: string,
  statusCode = 500
) {
  return res.status(statusCode).send({
    error: true,
    success: false,
    message: errorDesc,
    statusCode,
    data: null,
  } satisfies ResponseBody)
}

export default {
  successResponse,
  failResponse,
  errorResponse,
}
