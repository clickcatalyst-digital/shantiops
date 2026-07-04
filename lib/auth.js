// lib/auth.js
import jwt from 'jsonwebtoken';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.SESSION_SECRET || 'fallback-secret';
const COOKIE_NAME = 'token';

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      project_id: user.project_id ?? null,
      departments: parseDepartments(user.departments),
      display_name: user.display_name ?? null,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Departments are stored as a CSV string on the user row; the token/UI want an array.
export function parseDepartments(csv) {
  if (Array.isArray(csv)) return csv;
  if (!csv) return [];
  return String(csv).split(',').map(s => s.trim()).filter(Boolean);
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// For use inside Route Handlers / Server Components (reads the httpOnly cookie).
export function getSessionUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// For use inside Route Handlers when you need to read an Authorization header instead.
export function getUserFromRequest(req) {
  const authHeader = req.headers.get?.('authorization') || headers().get('authorization');
  const bearer = authHeader?.replace('Bearer ', '');
  const cookieToken = cookies().get(COOKIE_NAME)?.value;
  const token = bearer || cookieToken;
  if (!token) return null;
  return verifyToken(token);
}

export const COOKIE_OPTS = {
  name: COOKIE_NAME,
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60
};

export const APPROVER_ROLES = ['admin', 'manager'];
export function isApprover(user) {
  return !!user && APPROVER_ROLES.includes(user.role);
}

// Role tiers. Internal = runs the factory; external = the customer who placed the order.
export function isCustomer(user) { return user?.role === 'customer'; }
export function isInternal(user) { return !!user && !isCustomer(user); }
export function isManager(user) { return !!user && ['admin', 'manager'].includes(user.role); } // sees Executive

// Redesign role model: admin/manager collapse into "PM"; operator becomes "Functional Head".
export function isPM(user) { return isManager(user); }
export function isHead(user) { return user?.role === 'operator'; }
export function headDepartments(user) { return parseDepartments(user?.departments); }

// PM can reach every department; a head only their granted list. Customers: never.
export function canAccessDepartment(user, dept) {
  if (isPM(user)) return true;
  if (isHead(user)) return headDepartments(user).includes(dept);
  return false;
}

// Route-handler guards — return an error Response when the check fails, else null.
export function requirePM(user) {
  if (isPM(user)) return null;
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
export function requireDepartment(user, dept) {
  if (canAccessDepartment(user, dept)) return null;
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Where a role belongs after login / when it hits a page it may not see.
export function roleHome(user) {
  if (isCustomer(user)) return user.project_id ? `/portal/${user.project_id}` : '/login';
  if (isPM(user)) return '/executive'; // PM lands strategic-first
  return '/';
}
