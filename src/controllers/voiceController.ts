import { Request, Response } from 'express';
import { statusCodes } from '../common/statusCodes';
import logger from '../common/logger';

// Example function to handle voice-related requests
export const handleVoiceRequest = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { callingParticipant, callerId, dialKey } = req.query;

    // Validate required parameters
    if (!callingParticipant || !callerId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: 'Both callingParticipant and callerId are required.',
      });
    }

    // Validate dialKey (must be between 1 and 9)
    if (!dialKey || isNaN(Number(dialKey)) || Number(dialKey) < 1 || Number(dialKey) > 9) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: 'dialKey is required and must be a number between 1 and 9.',
      });
    }

    // Map dialKey to a specific phone number
    const dialKeyToNumberMap: { [key: string]: string } = {
      "1": "1234567890",
      "2": "9876543210",
      "3": "1122334455",
      "4": "5566778899",
      "5": "9988776655",
      "6": "6677889900",
      "7": "7788990011",
      "8": "8899001122",
      "9": "9900112233",
    };

    const routedNumber = dialKeyToNumberMap[dialKey as string];

    if (!routedNumber) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: `No routing number found for dialKey: ${dialKey}`,
      });
    }

    // Construct the response object
    const responsePayload = {
      client_add_participant: {
        participants: [
          {
            participantName: callingParticipant,
            participantAddress: "9392392143", // Example participant address
            outBoundNO: routedNumber, // Route to the mapped number
            callerId: callerId,
            dialKey: Number(dialKey),
            maxRetries: 1,
            audioId: 0,
            maxTime: 0,
            enableEarlyMedia: "false",
          },
          {
            participantName: callingParticipant,
            participantAddress: "9392392143", // Example participant address
            outBoundNO: routedNumber, // Route to the mapped number
            callerId: callerId,
            dialKey: Number(dialKey),
            maxRetries: 1,
            audioId: 0,
            maxTime: 0,
            enableEarlyMedia: "false",
          },
          {
            participantName: callingParticipant,
            participantAddress: "9490219062", // Example participant address
            outBoundNO: routedNumber, // Route to the mapped number
            callerId: callerId,
            dialKey: Number(dialKey),
            maxRetries: 1,
            audioId: 0,
            maxTime: 0,
            enableEarlyMedia: "false",
          },
          {
            participantName: callingParticipant,
            participantAddress: "9494999989", // Example participant address
            outBoundNO: routedNumber, // Route to the mapped number
            callerId: callerId,
            dialKey: Number(dialKey),
            maxRetries: 1,
            audioId: 0,
            maxTime: 0,
            enableEarlyMedia: "false",
          },
          {
            participantName: callingParticipant,
            participantAddress: "9701646859", // Example participant address
            outBoundNO: routedNumber, // Route to the mapped number
            callerId: callerId,
            dialKey: Number(dialKey),
            maxRetries: 1,
            audioId: 0,
            maxTime: 0,
            enableEarlyMedia: "false",
          },
        ],
        mergingStrategy: "SEQUENTIAL",
        maxTime: 0,
      },
    };

    // Log the response payload
    logger.info(`Constructed response payload: ${JSON.stringify(responsePayload)}`);

    // Return the response
    return res.status(statusCodes.SUCCESS).json(responsePayload);
  } catch (error: unknown) {
    logger.error(`Error processing voice request: ${error instanceof Error ? error.message : error}`);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'An error occurred while processing the voice request.',
    });
  }
};