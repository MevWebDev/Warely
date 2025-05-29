import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret";

export async function generateTokens(userId: string) {
  // Generate access token (15 minutes)
  const accessToken = jwt.sign({ userId, type: "access" }, JWT_SECRET, {
    expiresIn: "15m",
  });

  // Generate refresh token (7 days)
  const refreshTokenValue = uuidv4();
  const refreshToken = jwt.sign(
    { userId, tokenId: refreshTokenValue, type: "refresh" },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  // Store refresh token in database
  await prisma.refreshToken.create({
    data: {
      token: refreshTokenValue,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { accessToken, refreshToken };
}

export async function verifyRefreshToken(
  token: string
): Promise<string | null> {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;

    // Check if token exists in database
    const dbToken = await prisma.refreshToken.findFirst({
      where: {
        token: decoded.tokenId,
        userId: decoded.userId,
        expiresAt: { gt: new Date() },
      },
    });

    if (!dbToken) {
      return null;
    }

    return decoded.userId;
  } catch (error) {
    return null;
  }
}

export function verifyAccessToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}
