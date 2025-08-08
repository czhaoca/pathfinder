const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createLearningRoutes(container) {
  const router = express.Router();
  const authMiddleware = container.get('authMiddleware');
  const controller = container.get('learningController');

  // Require authentication for all learning endpoints
  router.use(authMiddleware.authenticate());

  // Courses
  router.get('/courses/search',
    ErrorHandler.asyncWrapper((req, res, next) => controller.searchCourses(req, res, next))
  );
  router.get('/courses/recommended',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getRecommendedCourses(req, res, next))
  );
  router.get('/courses/enrolled',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getEnrolledCourses(req, res, next))
  );
  router.get('/courses/stats',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getCourseStats(req, res, next))
  );
  router.get('/courses/:courseId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getCourseDetails(req, res, next))
  );
  router.post('/courses/enroll',
    ErrorHandler.asyncWrapper((req, res, next) => controller.enrollInCourse(req, res, next))
  );
  router.put('/courses/:enrollmentId/progress',
    ErrorHandler.asyncWrapper((req, res, next) => controller.updateCourseProgress(req, res, next))
  );
  router.post('/courses/:enrollmentId/complete',
    ErrorHandler.asyncWrapper((req, res, next) => controller.completeCourse(req, res, next))
  );

  // Assessments
  router.get('/assessments',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getAssessments(req, res, next))
  );
  router.get('/assessments/results',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getAssessmentResults(req, res, next))
  );
  router.get('/assessments/summary',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getSkillAssessmentSummary(req, res, next))
  );
  router.get('/assessments/:assessmentId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getAssessmentDetails(req, res, next))
  );
  router.post('/assessments/:assessmentId/start',
    ErrorHandler.asyncWrapper((req, res, next) => controller.startAssessment(req, res, next))
  );
  router.post('/assessments/:assessmentId/submit',
    ErrorHandler.asyncWrapper((req, res, next) => controller.submitAssessment(req, res, next))
  );
  router.post('/assessments/generate',
    ErrorHandler.asyncWrapper((req, res, next) => controller.generateAIAssessment(req, res, next))
  );

  // Certifications
  router.get('/certifications/catalog',
    ErrorHandler.asyncWrapper((req, res, next) => controller.browseCertifications(req, res, next))
  );
  router.get('/certifications/my',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getUserCertifications(req, res, next))
  );
  router.get('/certifications/expiring',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getExpiringCertifications(req, res, next))
  );
  router.get('/certifications/recommended',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getRecommendedCertifications(req, res, next))
  );
  router.get('/certifications/stats',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getCertificationStats(req, res, next))
  );
  router.get('/certifications/cpe-credits',
    ErrorHandler.asyncWrapper((req, res, next) => controller.calculateCPECredits(req, res, next))
  );
  router.get('/certifications/:certificationId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getCertificationDetails(req, res, next))
  );
  router.post('/certifications/add',
    ErrorHandler.asyncWrapper((req, res, next) => controller.addUserCertification(req, res, next))
  );
  router.put('/certifications/:userCertId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.updateCertification(req, res, next))
  );

  return router;
}

module.exports = createLearningRoutes;

