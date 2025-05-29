import { Router } from "express";

const router: Router = Router();

router.get("/", async (req, res) => {
  res.json({ message: "Suppliers endpoint", data: [] });
});

export default router;
