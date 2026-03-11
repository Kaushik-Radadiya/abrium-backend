import { Router } from 'express'
import { catalogRouter } from './catalogRoutes.js'
import { userRouter } from './userRoutes.js'
import { riskRouter } from './riskRoutes.js'

export const apiRouter = Router()

apiRouter.use('/catalog', catalogRouter)
apiRouter.use('/user', userRouter)
apiRouter.use('/risk', riskRouter)
