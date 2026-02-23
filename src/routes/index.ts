import { Router } from 'express'
import { riskRouter } from './riskRoutes.js'

export const apiRouter = Router()

apiRouter.use('/risk', riskRouter)
