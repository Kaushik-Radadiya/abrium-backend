import { Router } from 'express'
import { getUserInfo } from '../controllers/userController.js'

export const userRouter = Router()

userRouter.get('/info', getUserInfo)
