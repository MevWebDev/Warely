import { Router } from "express";

const router: Router = Router();

router.get("/", async (req, res) => {
  res.json({ message: "Analytics endpoint", data: [] });
});

export default router;
