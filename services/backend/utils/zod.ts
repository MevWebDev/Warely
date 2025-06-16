import { z } from "zod";

export const handleZodError = (error: z.ZodError) => ({
  success: false,
  message: "Validation failed",
  errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
});
