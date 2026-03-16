import { db, auth } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  limit,
  serverTimestamp,
  writeBatch,
  Timestamp,
  orderBy,
  getCountFromServer
} from 'firebase/firestore';
import { AdminAction, AdminCommunityView, AdminUserView, AdminLog } from '../types/admin';
import { UserRole } from '../types/auth';

export const adminService = {
  /**
   * Write to admin audit log. Called internally by ALL admin actions.
   */
  writeAdminLog: async (action: AdminAction, targetId: string, reason: string): Promise<void> => {
    const adminId = auth.currentUser?.uid;
    if (!adminId) throw new Error("Requires authentication");

    const logRef = doc(collection(db, 'admin_logs'));
    const logData: Omit<AdminLog, 'createdAt'> & { createdAt: any } = {
      logId: logRef.id,
      action,
      targetId,
      adminId,
      reason,
      createdAt: serverTimestamp(),
    };

    await writeBatch(db).set(logRef, logData).commit();
  },

  /**
   * USERS
   */
  getAllUsers: async (limitCount: number = 50): Promise<AdminUserView[]> => {
    const q = query(collection(db, 'users'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        uid: d.id,
        displayName: data.displayName || 'Unknown User',
        email: data.email || 'No Email',
        role: data.role || 'user',
        status: data.status || 'active',
        plan: data.plan || 'free',
        stats: data.stats || {
          totalMalas: 0,
          totalMantras: 0,
          streakDays: 0,
          lastChantDate: null
        },
        joinedAt: data.joinedAt || Timestamp.now(),
      } as AdminUserView;
    });
  },

  searchUsers: async (term: string): Promise<AdminUserView[]> => {
    // Note: A true search requires Algolia. Using lightweight prefix search on displayName & email.
    // Client-side filtering is typically applied later for more robust filtering.
    // We will fetch up to 100 users and filter them if full text is needed, or just standard query.
    
    // As per prompt, filter by displayName or email client-side. We fetch a broader range or just 
    // fetch all within limits and let client filter, OR do a basic query here.
    const q = query(collection(db, 'users'), limit(100)); // Fetching 100 to search client-side
    const snap = await getDocs(q);
    const lowerTerm = term.toLowerCase();

    return snap.docs.map(d => {
      const data = d.data();
      return {
        uid: d.id,
        displayName: data.displayName || 'Unknown',
        email: data.email || 'Unknown',
        role: data.role || 'user',
        status: data.status || 'active',
        plan: data.plan || 'free',
        stats: data.stats || { totalMalas: 0, totalMantras: 0, streakDays: 0, lastChantDate: null },
        joinedAt: data.joinedAt || Timestamp.now(),
      } as AdminUserView;
    }).filter(user => 
      user.displayName.toLowerCase().includes(lowerTerm) || 
      user.email.toLowerCase().includes(lowerTerm)
    );
  },

  banUser: async (uid: string, reason: string): Promise<void> => {
    if (!reason.trim()) throw new Error("Ban reason is required.");
    const batch = writeBatch(db);
    
    // Update User Document
    const userRef = doc(db, 'users', uid);
    batch.update(userRef, { status: 'banned' });

    // Write Audit Log
    const adminId = auth.currentUser?.uid;
    if (!adminId) throw new Error("Requires authentication");
    const logRef = doc(collection(db, 'admin_logs'));
    batch.set(logRef, {
      logId: logRef.id,
      action: 'BAN_USER',
      targetId: uid,
      adminId,
      reason,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  unbanUser: async (uid: string): Promise<void> => {
    const batch = writeBatch(db);
    
    const userRef = doc(db, 'users', uid);
    batch.update(userRef, { status: 'active' });

    const adminId = auth.currentUser?.uid;
    if (!adminId) throw new Error("Requires authentication");
    const logRef = doc(collection(db, 'admin_logs'));
    batch.set(logRef, {
      logId: logRef.id,
      action: 'UNBAN_USER',
      targetId: uid,
      adminId,
      reason: 'Manual Unban',
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  assignRole: async (uid: string, role: UserRole): Promise<void> => {
    const batch = writeBatch(db);
    
    const userRef = doc(db, 'users', uid);
    batch.update(userRef, { role });

    const adminId = auth.currentUser?.uid;
    if (!adminId) throw new Error("Requires authentication");
    const logRef = doc(collection(db, 'admin_logs'));
    batch.set(logRef, {
      logId: logRef.id,
      action: 'ASSIGN_ROLE',
      targetId: uid,
      adminId,
      reason: `Assigned role: ${role}`,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  /**
   * COMMUNITIES
   */
  getAllCommunities: async (limitCount: number = 200): Promise<AdminCommunityView[]> => {
    // Sort featured first, then by members
    const q = query(collection(db, 'communities'), limit(limitCount));
    const snap = await getDocs(q);
    
    const communities = snap.docs.map(d => {
      const data = d.data();
      return {
        communityId: d.id,
        name: data.name || 'Unnamed Community',
        isPublic: !data.isPrivate,
        featured: data.featured || false,
        memberCount: data.membersCount || 0,
        createdBy: data.creatorId || 'Unknown',
        createdAt: data.createdAt || Timestamp.now(),
      } as AdminCommunityView;
    });

    // Sort: Featured true first, then memberCount descending
    return communities.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return b.memberCount - a.memberCount;
    });
  },

  featureCommunity: async (communityId: string): Promise<void> => {
    const batch = writeBatch(db);
    const commRef = doc(db, 'communities', communityId);
    batch.update(commRef, { featured: true });

    const adminId = auth.currentUser?.uid;
    if (!adminId) throw new Error("Requires authentication");
    const logRef = doc(collection(db, 'admin_logs'));
    batch.set(logRef, {
      logId: logRef.id,
      action: 'FEATURE_COMMUNITY',
      targetId: communityId,
      adminId,
      reason: 'Promoted to featured',
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  unfeatureCommunity: async (communityId: string): Promise<void> => {
    const batch = writeBatch(db);
    const commRef = doc(db, 'communities', communityId);
    batch.update(commRef, { featured: false });

    const adminId = auth.currentUser?.uid;
    if (!adminId) throw new Error("Requires authentication");
    const logRef = doc(collection(db, 'admin_logs'));
    batch.set(logRef, {
      logId: logRef.id,
      action: 'UNFEATURE_COMMUNITY',
      targetId: communityId,
      adminId,
      reason: 'Removed from featured',
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  deleteCommunity: async (communityId: string, reason: string): Promise<void> => {
    if (!reason.trim()) throw new Error("Delete reason is required.");
    const batch = writeBatch(db);
    const commRef = doc(db, 'communities', communityId);
    batch.delete(commRef);

    const adminId = auth.currentUser?.uid;
    if (!adminId) throw new Error("Requires authentication");
    const logRef = doc(collection(db, 'admin_logs'));
    batch.set(logRef, {
      logId: logRef.id,
      action: 'DELETE_COMMUNITY',
      targetId: communityId,
      adminId,
      reason,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  /**
   * STATS
   */
  getAppStats: async (): Promise<{ totalUsers: number, totalMalas: number, activeCommunities: number, totalDonations: number }> => {
    // Run counts in parallel for speed. Each is independent.
    const [usersSnap, activeCommSnap] = await Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(collection(db, 'communities')),
    ]);

    let totalMalas = 0;
    let totalDonations = 0;

    // Try the global_stats aggregation doc first (written by Cloud Functions).
    // Fall back to summing the top 100 users if it doesn't exist yet.
    const globalStatsRef = doc(db, 'global_stats', 'metrics');
    const globalStatsDoc = await getDoc(globalStatsRef);

    if (globalStatsDoc.exists()) {
      totalMalas = globalStatsDoc.data().totalMalas || 0;
      totalDonations = globalStatsDoc.data().totalDonations || 0;
    } else {
      // Fallback: estimate from top 100 users.
      // Note: requires a single-field index override on stats.totalMalas DESC —
      // add a fieldOverride in firestore.indexes.json if this query fails.
      try {
        const qTop = query(collection(db, 'users'), orderBy('stats.totalMalas', 'desc'), limit(100));
        const topSnap = await getDocs(qTop);
        totalMalas = topSnap.docs.reduce((acc, d) => acc + (d.data().stats?.totalMalas || 0), 0);
      } catch {
        // If the fallback query also fails (e.g. index not built yet), show 0 rather than crashing
        totalMalas = 0;
      }
    }

    return {
      totalUsers: usersSnap.data().count,
      totalMalas,
      activeCommunities: activeCommSnap.data().count,
      totalDonations
    };
  }
};
