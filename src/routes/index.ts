import { Router } from 'express'
import { catalogRouter } from './catalogRoutes.js'
import { riskRouter } from './riskRoutes.js'

export const apiRouter = Router()

apiRouter.use('/catalog', catalogRouter)
apiRouter.use('/risk', riskRouter)
