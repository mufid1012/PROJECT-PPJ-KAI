import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ppj-kai-secret-key';
const JWT_EXPIRES_IN = '1d';

export const generateToken = (userId: number, role: string): string => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};
