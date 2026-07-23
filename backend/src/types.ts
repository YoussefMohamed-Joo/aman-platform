// ─── Data Types ───────────────────────────────────────────

export interface MissingReport {
  id: number;
  userId?: number;
  name: string;
  age: number;
  gender: 'male' | 'female';
  governorate: string;
  location: string;
  since: string;
  date: string;
  description: string;
  features: string;
  health: string;
  contact: string;
  reporter: string;
  image: string;
  imageHash?: string;
  imageColors?: number[][];
  clothingImage?: string;
  clothingHash?: string;
  clothingColors?: number[][];
  featureImages?: string;
  status: 'searching' | 'found';
  reportStatus: 'pending' | 'verified' | 'rejected';
  coords: string;
  timestamp: number;
}

export interface SightingReport {
  id: number;
  userId?: number;
  missingPersonName: string;
  reporter: string;
  phone: string;
  location: string;
  date: string;
  description: string;
  image: string | null;
  imageHash?: string;
  imageColors?: number[][];
  verified?: boolean;
  timestamp: number;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  timestamp: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  password: string;
  provider: 'local' | 'google' | 'facebook';
  providerId?: string;
  isAdmin: number;
  createdAt: number;
}

export interface AppData {
  users: User[];
  missingReports: MissingReport[];
  sightingReports: SightingReport[];
  contactMessages: ContactMessage[];
  notifications?: Notification[];
}

export interface Notification {
  id: number;
  type: 'match' | 'status' | 'info' | 'alert';
  title: string;
  message: string;
  reportId?: number;
  reportType?: 'missing' | 'sighting';
  read: boolean;
  createdAt: number;
}

export interface MatchResult {
  missing: MissingReport;
  score: number;
  pieces: string[];
}

export interface VisualSearchResult {
  type: 'missing' | 'sighting';
  id: number;
  name: string;
  age?: number;
  gender?: string;
  location: string;
  description: string;
  image?: string;
  score: number;
  details: string[];
  reporter?: string;
  date?: string;
  reportStatus?: string;
  status?: string;
  matchImage?: any;
}

export interface StatsData {
  totalFound: number;
  totalActive: number;
  totalVerified: number;
  totalMembers: number;
  totalMissing: number;
  totalSightings: number;
}

export interface ReportFilters {
  name?: string;
  governorate?: string;
  gender?: string;
  status?: string;
  reportStatus?: string;
  age?: string;
}

export interface ProcessedImage {
  dataUri: string;
  hash: string;
  colors: number[][];
  colorNames: string[];
}

export interface AuthRequest {
  email: string;
  name?: string;
  password?: string;
  phone?: string;
  provider?: string;
  providerId?: string;
}

export interface JwtPayload {
  id: number;
  email: string;
  name: string;
}

// ─── Admin / Security Types ─────────────────────────────────

export interface UserSession {
  id: number;
  userId: number;
  ip: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  loginAt: number;
  lastActivity: number;
  logoutAt: number | null;
  active: number;
}

export interface UserAction {
  id: number;
  userId: number;
  action: string;
  details: string;
  ip: string;
  timestamp: number;
}

export interface ErrorLog {
  id: number;
  level: string;
  context: string;
  message: string;
  stack: string;
  ip: string;
  userId: number;
  url: string;
  timestamp: number;
}

export interface AdminStats {
  totalUsers: number;
  totalSessions: number;
  activeSessions: number;
  totalActions: number;
  totalErrors: number;
  totalMessages: number;
  usersToday: number;
  uniqueIps: number;
}

export interface AdminUser extends User {
  sessions?: UserSession[];
  recentActions?: UserAction[];
  ip?: string;
  lastLogin?: number;
}
