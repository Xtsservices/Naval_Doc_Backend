import { Request, Response, NextFunction } from 'express';

// Extend the Request interface to include the 'user' property
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        userId?: number;
        email?: string;
        firstName?: string;
        lastName?: string;
        phoneNumber?: string;
        roleId?: number | null;
        roleName?: string | null;
        canteenId?: number | null;
        exp?: number;
        iat?: number;
      };
    }
  }
}
import jwt, { JwtPayload } from 'jsonwebtoken';
import { getCustomerDetails, getMessage } from '../common/utils';
import { statusCodes } from '../common/statusCodes';
import logger from '../common/logger';

const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization;
  if (Array.isArray(token)) {
    return res.status(statusCodes.UNAUTHORIZED).json({
      message: getMessage('error.tokenRequired'),
    });
  }
  if (!token) {
    return res.status(statusCodes.UNAUTHORIZED).json({
      message: getMessage('error.tokenRequired'),
    });
  }

  try {

    const secretKey = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secretKey) as JwtPayload;

    // Check if the token has expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(statusCodes.UNAUTHORIZED).json({
        message: getMessage('error.tokenExpired'),
      });
    }

    // Attach the decoded token to the request object for further use
    req.user = decoded as JwtPayload;

    if (!req.user?.userId) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('error.invalidUserId'),
      });
    }
    let user: any = await getCustomerDetails(req.user.userId);

    const beautifiedUser = beautifyUser(user);
    if (!beautifiedUser) {
      return res.status(statusCodes.BAD_REQUEST).json({
        message: getMessage('error.invalidUser'),
      });
    }
    req.user = beautifiedUser;

    // req.user = {
    //   userId: user.userId,
    //   email: user.email,
    //   firstName: user.firstName,
    //   lastName: user.lastName,
    //   phoneNumber: user.phoneNumber,
    //   roleId: user.userRoles[0].roleId,
    //   roleName: user.userRoles[0].role.name,
    //   canteenId: user.canteenId,  
    //   exp: decoded.exp,
    //   iat: decoded.iat,
    // }

    // console.log('Decoded token:', 2, req.user);



    next(); // Token is valid, proceed to the next middleware or controller
  } catch (error) {
    return res.status(statusCodes.UNAUTHORIZED).json({
      message: getMessage('error.invalidToken'),
    });
  }
};

export default authenticateToken;

  const beautifyUser = (user: any) => {
    if (!user) return null;
  
    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobile: user.mobile,
      canteenId: user.canteenId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      userRoles: user.userRoles.map((userRole: any) => ({
        id: userRole.id,
        userId: userRole.userId,
        roleId: userRole.roleId,
        createdAt: userRole.createdAt,
        updatedAt: userRole.updatedAt,
        role: {
          id: userRole.role.id,
          name: userRole.role.name,
          createdAt: userRole.role.createdAt,
          updatedAt: userRole.role.updatedAt
        }
      }))
    };
  };

