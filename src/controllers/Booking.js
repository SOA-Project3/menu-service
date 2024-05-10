const { PubSub } = require('@google-cloud/pubsub');
const statusCodes = require("../constants/statusCodes");

const keyFilename = process.env.keyfile;

const subscriber = new PubSub({
  keyFilename: keyFilename,
});
const publisher = new PubSub({
  keyFilename: keyFilename,
});
// Set up a subscription to listen for messages
const subscriptionName = 'recommendation-service-sub';
const subscription = subscriber.subscription(subscriptionName);

async function availableScheduleSlots(req, res, next) {
  try {
    const topicName = 'booking-backend';
    // Publish the recommendation request
    await publishMessage(topicName, "getAllScheduleLots", "getAllScheduleLots");

    // Wait for the recommendation response from the subscription
    const recommendation = await waitForRecommendation();
    
    // Send the recommendation response to the client
    res.status(statusCodes.OK).json(recommendation);
  } catch (error) {
    console.error('Error publishing booking request:', error);
    res.status(statusCodes.INTERNAL_SERVER_ERROR).send('Error publishing booking request.');
  }
}

async function userScheduleSlots(req, res, next) {
  try {
    const query = req.query;
    console.log(query)

    // Check if query is null, undefined, or an empty object
    if (!query || Object.keys(query).length === 0) {
      return res.status(statusCodes.BAD_REQUEST).json('Query params are missing');
    }

    // Check if the only parameter is UserId
    if (Object.keys(query).length !== 1 || !query.hasOwnProperty('userId')) {
      return res.status(statusCodes.BAD_REQUEST).json('Only UserId parameter is allowed');
    }

    // Check if UserId value is empty or null
    if (!query.userId || !query.userId.trim()) {
      return res.status(statusCodes.BAD_REQUEST).json('UserId value is empty or null');
    }

    const topicName = 'booking-backend';
    // Publish the recommendation request
    await publishMessage(topicName, query, "userSchedulesLots");

    // Wait for the recommendation response from the subscription
    const userSchedulesLots_response = await waitForRecommendation();

    // If recommendation is empty, return a "Not Found" response
    if (!userSchedulesLots_response) {
      return res.status(statusCodes.NOT_FOUND).json('User has no reservations');
    }
    
    // Send the recommendation response to the client
    res.status(statusCodes.OK).json(userSchedulesLots_response);
  } catch (error) {
    console.error('Error publishing booking request:', error);
    res.status(statusCodes.INTERNAL_SERVER_ERROR).json('Error publishing booking request.');
  }
};

async function allScheduleSlots(req, res, next) {
  try {
    const topicName = 'booking-backend';
    // Publish the recommendation request
    await publishMessage(topicName, "allScheduleSlots", "allScheduleSlots");

    // Wait for the recommendation response from the subscription
    const allScheduleSlots_response = await waitForRecommendation();
    
    // Send the recommendation response to the client
    res.status(statusCodes.OK).json(allScheduleSlots_response.message);
  } catch (error) {
    console.error('Error publishing booking request:', error);
    res.status(statusCodes.INTERNAL_SERVER_ERROR).json('Error publishing booking request.');
  }
};

async function bookedScheduleSlots(req, res, next) {
  try {
    const topicName = 'booking-backend';
    // Publish the recommendation request
    await publishMessage(topicName, "bookedScheduleSlots", "bookedScheduleSlots");

    // Wait for the recommendation response from the subscription
    const bookedScheduleSlots_response = await waitForRecommendation();
    if(bookedScheduleSlots_response.status === 404){
      res.status(statusCodes.NOT_FOUND).json(bookedScheduleSlots_response);   
    }else{
      // Send the recommendation response to the client
      res.status(statusCodes.OK).json(bookedScheduleSlots_response.message);  
    }
  } catch (error) {
    console.error('Error publishing booking request:', error);
    res.status(statusCodes.INTERNAL_SERVER_ERROR).json('Error publishing booking request.');
  }
};

async function bookScheduleSlot(req, res, next) {
  try {
    const query = req.query;
    console.log(query)

    // Check if query is null, undefined, or an empty object
    if (!query || Object.keys(query).length === 0) {
      return res.status(statusCodes.BAD_REQUEST).json('Query params are missing');
    }

    // Validate query parameters
    const allowedKeys = ['userId', 'scheduleSlotId', 'peopleQuantity'];
    const queryKeys = Object.keys(query);

    // Check if all required keys are present
    const missingKeys = allowedKeys.filter(key => !queryKeys.includes(key));
    if (missingKeys.length > 0) {
      return res.status(statusCodes.BAD_REQUEST).json(`Missing required parameter(s): ${missingKeys.join(', ')}`);
    }

    // Check if any extra keys are present
    const extraKeys = queryKeys.filter(key => !allowedKeys.includes(key));
    if (extraKeys.length > 0) {
      return res.status(statusCodes.BAD_REQUEST).json(`Unexpected parameter(s): ${extraKeys.join(', ')}`);
    }

    const topicName = 'booking-backend';
    // Publish the recommendation request
    await publishMessage(topicName, query, "bookScheduleSlot");

    // Wait for the recommendation response from the subscription
    const bookScheduleSlot_response = await waitForRecommendation();

    // If recommendation is empty, return a "Not Found" response
    if (bookScheduleSlot_response.status === 400) {
      return res.status(statusCodes.BAD_REQUEST).json(bookScheduleSlot_response.error);
    }else{
      // Send the recommendation response to the client
      res.status(statusCodes.OK).json(bookScheduleSlot_response.message);
    }
    
  } catch (error) {
    console.error('Error publishing booking request:', error);
    res.status(statusCodes.INTERNAL_SERVER_ERROR).json('Error publishing booking request.');
  }
};



async function publishMessage(topicName, data, filter) {
  const jsonString = data ? JSON.stringify(data): '';
  const dataBuffer = Buffer.from(jsonString);
  const attributes = {
    name: filter
  };
  console.log(attributes)
    try {
    const messageId = await publisher
      .topic(topicName)
      .publishMessage({data:dataBuffer, attributes:attributes} );
    console.log(`Message ${messageId} published.`);
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    throw error;
  }
}


async function waitForRecommendation() {
  // Return the stored recommendation data
  return new Promise((resolve, reject) => {
      // If recommendation data is not available, wait for the next message
      subscription.on('message', async (message) => {
        try {
          // Process the received message
          const data = JSON.parse(message.data.toString());
          console.log('Received response');
          console.log(data);
          message.ack();
          resolve(data);
        } catch (error) {
          console.error('Error processing recommendation message:', error);
          // Acknowledge the message to prevent reprocessing
          message.ack();
          reject(error);
        }
      });   
  });
}

module.exports = {
  availableScheduleSlots,
  userScheduleSlots,
  allScheduleSlots,
  bookedScheduleSlots,
  bookScheduleSlot
};