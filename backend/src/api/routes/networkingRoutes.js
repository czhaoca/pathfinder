const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createNetworkingRoutes(container) {
  const router = express.Router();
  const authMiddleware = container.get('authMiddleware');
  const controller = container.get('networkingController');

  // Require auth for all networking routes
  router.use(authMiddleware.authenticate());

  // Contacts
  router.get('/contacts',
    ErrorHandler.asyncWrapper((req, res, next) => controller.listContacts(req, res, next))
  );
  router.get('/contacts/search',
    ErrorHandler.asyncWrapper((req, res, next) => controller.searchContacts(req, res, next))
  );
  router.get('/contacts/analytics',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getContactAnalytics(req, res, next))
  );
  router.get('/contacts/:contactId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getContact(req, res, next))
  );
  router.post('/contacts',
    ErrorHandler.asyncWrapper((req, res, next) => controller.createContact(req, res, next))
  );
  router.put('/contacts/:contactId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.updateContact(req, res, next))
  );
  router.delete('/contacts/:contactId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.deleteContact(req, res, next))
  );
  router.post('/contacts/:contactId/tags',
    ErrorHandler.asyncWrapper((req, res, next) => controller.addContactTags(req, res, next))
  );

  // Interactions
  router.get('/interactions',
    ErrorHandler.asyncWrapper((req, res, next) => controller.listInteractions(req, res, next))
  );
  router.post('/interactions',
    ErrorHandler.asyncWrapper((req, res, next) => controller.logInteraction(req, res, next))
  );
  router.get('/interactions/:interactionId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getInteraction(req, res, next))
  );
  router.put('/interactions/:interactionId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.updateInteraction(req, res, next))
  );

  // Meeting notes
  router.post('/meetings',
    ErrorHandler.asyncWrapper((req, res, next) => controller.createMeetingNotes(req, res, next))
  );
  router.put('/meetings/:meetingId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.updateMeetingNotes(req, res, next))
  );
  router.get('/meetings/insights',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getMeetingInsights(req, res, next))
  );

  // Reminders
  router.get('/reminders',
    ErrorHandler.asyncWrapper((req, res, next) => controller.listReminders(req, res, next))
  );
  router.post('/reminders',
    ErrorHandler.asyncWrapper((req, res, next) => controller.createReminder(req, res, next))
  );
  router.put('/reminders/:reminderId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.updateReminder(req, res, next))
  );
  router.post('/reminders/:reminderId/complete',
    ErrorHandler.asyncWrapper((req, res, next) => controller.completeReminder(req, res, next))
  );
  router.get('/reminders/upcoming',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getUpcomingReminders(req, res, next))
  );

  // Recommendations and insights
  router.get('/networking/recommendations',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getRecommendations(req, res, next))
  );
  router.post('/networking/recommendations/:recommendationId/dismiss',
    ErrorHandler.asyncWrapper((req, res, next) => controller.dismissRecommendation(req, res, next))
  );
  router.get('/networking/insights',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getNetworkingInsights(req, res, next))
  );

  return router;
}

module.exports = createNetworkingRoutes;

