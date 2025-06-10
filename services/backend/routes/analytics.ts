import { Router, Request, Response } from "express";
import { Analytics } from "../models/analytics";
import { z } from "zod";

const router: Router = Router();

// Validation schemas
const trackEventSchema = z.object({
  event: z.string().min(1, "Event name is required"),
  data: z.any().optional(),
  userId: z.string().optional(),
});

const analyticsQuerySchema = z.object({
  event: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().optional(),
  page: z.string().optional(),
});

// POST /api/analytics/track - Track a new event
router.post("/track", async (req: Request, res: Response) => {
  try {
    const validatedData = trackEventSchema.parse(req.body);

    const analyticsEvent = new Analytics({
      event: validatedData.event,
      data: validatedData.data,
      userId: validatedData.userId,
      timestamp: new Date(),
    });

    await analyticsEvent.save();

    res.status(201).json({
      success: true,
      message: "Event tracked successfully",
      data: analyticsEvent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    console.error("Error tracking analytics event:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track event",
    });
  }
});

// GET /api/analytics/events - Get analytics events with filtering
router.get("/events", async (req: Request, res: Response) => {
  try {
    const query = analyticsQuerySchema.parse(req.query);

    // Build MongoDB filter
    const filter: any = {};

    if (query.event) {
      filter.event = query.event;
    }

    if (query.userId) {
      filter.userId = query.userId;
    }

    if (query.startDate || query.endDate) {
      filter.timestamp = {};
      if (query.startDate) {
        filter.timestamp.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.timestamp.$lte = new Date(query.endDate);
      }
    }

    const limit = query.limit ? parseInt(query.limit) : 100;
    const page = query.page ? parseInt(query.page) : 1;
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      Analytics.find(filter)
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Analytics.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching analytics events:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch events",
    });
  }
});

export default router;
