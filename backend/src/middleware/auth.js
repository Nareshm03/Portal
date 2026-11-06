import { getSupabase } from '../config/supabase.js';
import { HttpError } from '../utils/httpError.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.get('authorization') ?? '';
    const match = /^Bearer\s+([A-Za-z0-9._~+/-]+=*)$/i.exec(header);
    if (!match) throw new HttpError(401, 'AUTH_REQUIRED', 'A valid bearer token is required.');

    const { data, error } = await getSupabase().auth.getUser(match[1]);
    if (error || !data?.user) throw new HttpError(401, 'INVALID_TOKEN', 'Authentication failed.');
    req.user = { id: data.user.id, email: data.user.email ?? null };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles) {
  return async (req, _res, next) => {
    try {
      if (!req.user?.id) throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.');
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('role, account_status, kyc_status')
        .eq('id', req.user.id)
        .single();
      if (error || !data) throw new HttpError(403, 'PROFILE_REQUIRED', 'Your account profile is not available.');
      if (data.account_status !== 'ACTIVE') throw new HttpError(403, 'ACCOUNT_RESTRICTED', 'This account is not active.');
      if (!allowedRoles.includes(data.role)) throw new HttpError(403, 'ROLE_FORBIDDEN', 'You do not have permission to perform this action.');
      req.profile = data;
      next();
    } catch (error) {
      next(error);
    }
  };
}
