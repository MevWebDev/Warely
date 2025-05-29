import { Router } from "express";

const router: Router = Router();

router.get("/", async (req, res) => {
  res.json({ message: "Orders endpoint", data: [] });
});

export default router;
