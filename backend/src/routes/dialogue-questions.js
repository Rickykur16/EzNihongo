import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, asyncHandler } from '../middleware.js';
import { listLearnerDialogueQuestions, answerDialogueQuestion,
  latestDialogueQuestionAttempt } from '../dialogue-question-learner.js';

const limiter = rateLimit({ windowMs: 60_000, limit: 30,
  standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: req => req.user.id,
  message: { error: 'too_many_requests' } });
const privateNoStore = (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
};

export function createDialogueQuestionRouter({ auth = requireAuth,
  list = listLearnerDialogueQuestions, answer = answerDialogueQuestion,
  latest = latestDialogueQuestionAttempt, answerLimiter = limiter } = {}) {
  const router = Router();
  router.get('/lessons/:lessonId/dialogue-questions', privateNoStore, auth, asyncHandler(async (req, res) => {
    const result = await list(req.params.lessonId, req.user);
    res.json(result);
  }));
  router.post('/dialogue-questions/:id/answer', privateNoStore, auth, answerLimiter,
    asyncHandler(async (req, res) => {
      const result = await answer(req.params.id, req.user, req.body, {
        onDisposition: disposition => { res.locals.learningFlowDisposition = disposition; },
      });
      res.status(200).json(result);
    }));
  router.get('/dialogue-questions/:id/attempts/latest', privateNoStore, auth, asyncHandler(async (req, res) => {
    const result = await latest(req.params.id, req.user, req.query.questionVersion || null);
    if (!result) return res.status(204).end();
    res.json(result);
  }));
  return router;
}

export default createDialogueQuestionRouter();
