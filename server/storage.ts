import { db, questions, sources, accessCodes, suspendedMobiles, learnerProfiles, studySigns, signQuestions, studyRules, ruleQuestions, controlDiagrams, studyControls, controlQuestions, learnerProgress, learnerTestRuns } from './db.js';
import { Question, InsertQuestion, Source, InsertSource, AccessCode, InsertAccessCode, SuspendedMobile, InsertSuspendedMobile, LearnerProfile, InsertLearnerProfile, AdminUserSummary, AdminUserStatus, AccessCodeType, StudySign, InsertStudySign, SignQuestionLink, StudyRule, InsertStudyRule, RuleQuestionLink, ControlDiagram, InsertControlDiagram, StudyControl, InsertStudyControl, ControlQuestionLink, RawControlBundle, LearnerProgressRow, InsertLearnerProgress, InsertTestHistoryRun, TestHistoryRunPayload } from '../shared/schema.js';
import { eq, ne, inArray, desc, and, sql, or, ilike, count, countDistinct, notExists } from 'drizzle-orm';

export interface LinkCoverageModule {
  questions: { total: number; linked: number };
  cards: { total: number; linked: number };
}

export type LinkCoverage = Record<'signs' | 'rules' | 'controls', LinkCoverageModule>;

export interface UnlinkedItem {
  id: number;
  label: string;
  heading?: string | null;
  category?: number;
  question_number?: number;
}

export interface UnlinkedPage {
  items: UnlinkedItem[];
  total: number;
}

export interface IStorage {
  getQuestions(): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: number): Promise<boolean>;
  bulkUploadQuestions(newQuestions: InsertQuestion[]): Promise<void>;
  bulkUpdateSource(ids: number[], sourceId: number | null): Promise<void>;
  bulkDeleteQuestions(ids: number[]): Promise<void>;
  bulkUpdateOfficial(ids: number[], isOfficial: boolean): Promise<void>;
  bulkUpdateCategory(ids: number[], category: number): Promise<void>;
  bulkUpdateDuplicate(ids: number[], isDuplicate: boolean): Promise<void>;


  getSources(): Promise<Source[]>;
  getActiveSources(): Promise<Source[]>;
  createSource(source: InsertSource): Promise<Source>;
  updateSource(id: number, source: Partial<InsertSource>): Promise<Source | undefined>;
  toggleSourceActive(id: number, isActive: boolean): Promise<Source | undefined>;
  deleteSource(id: number): Promise<boolean>;

  getAccessCodes(): Promise<AccessCode[]>;
  getAccessCodeByCode(code: string): Promise<AccessCode | undefined>;
  getAccessCodeById(id: number): Promise<AccessCode | undefined>;
  createAccessCode(data: InsertAccessCode): Promise<AccessCode>;
  revokeAccessCode(id: number): Promise<AccessCode | undefined>;
  revokeAccessCodesByMobile(mobileNumber: string, exceptId?: number): Promise<number>;
  deleteAccessCode(id: number): Promise<boolean>;
  deleteAccessCodesByMobile(mobileNumber: string): Promise<number>;

  getSuspendedMobile(mobileNumber: string): Promise<SuspendedMobile | undefined>;
  isMobileSuspended(mobileNumber: string): Promise<boolean>;
  suspendMobile(data: InsertSuspendedMobile): Promise<SuspendedMobile>;
  unsuspendMobile(mobileNumber: string): Promise<boolean>;
  getLearnerProfile(mobileNumber: string): Promise<LearnerProfile | undefined>;
  upsertLearnerProfile(data: InsertLearnerProfile): Promise<LearnerProfile>;
  deleteLearnerProfile(mobileNumber: string): Promise<boolean>;
  getAdminUsers(): Promise<AdminUserSummary[]>;
  deleteUserData(mobileNumber: string): Promise<{ codes: number; progress: number; tests: number; suspension: boolean; profile: boolean }>;

  getSigns(filters?: { heading?: string; subheading?: string; search?: string; verified?: boolean; missingImage?: boolean }): Promise<StudySign[]>;
  getSignById(id: number): Promise<(StudySign & { question_ids: number[] }) | undefined>;
  createSign(data: InsertStudySign): Promise<StudySign>;
  updateSign(id: number, data: Partial<InsertStudySign>): Promise<StudySign | undefined>;
  approveShortTextDrafts(): Promise<number>;
  deleteSign(id: number): Promise<boolean>;
  bulkInsertSigns(rows: InsertStudySign[]): Promise<{ inserted: number; skipped: number }>;
  getQuestionsForSign(signId: number): Promise<Question[]>;
  linkSignQuestion(signId: number, questionId: number): Promise<SignQuestionLink>;
  unlinkSignQuestion(signId: number, questionId: number): Promise<boolean>;
  removeSignCode(signId: number, code: string): Promise<StudySign | undefined>;
  removeSignImage(signId: number, code: string): Promise<StudySign | undefined>;

  getRules(filters?: { code?: number; heading?: string; subheading?: string; search?: string; verified?: boolean; missingQuestion?: boolean; unreviewed?: boolean }): Promise<StudyRule[]>;
  getRuleById(id: number): Promise<(StudyRule & { question_ids: number[] }) | undefined>;
  createRule(data: InsertStudyRule): Promise<StudyRule>;
  updateRule(id: number, data: Partial<InsertStudyRule>): Promise<StudyRule | undefined>;
  deleteRule(id: number): Promise<boolean>;
  bulkInsertRules(rows: InsertStudyRule[]): Promise<{ inserted: number; skipped: number }>;
  getQuestionsForRule(ruleId: number): Promise<Question[]>;
  getAllRuleQuestionLinks(): Promise<RuleQuestionLink[]>;
  linkRuleQuestion(ruleId: number, questionId: number): Promise<RuleQuestionLink>;
  unlinkRuleQuestion(ruleId: number, questionId: number): Promise<boolean>;

  getSignsForQuestion(questionId: number): Promise<StudySign[]>;
  getRulesForQuestion(questionId: number): Promise<StudyRule[]>;
  getCardLinksForQuestions(ids: number[]): Promise<Record<number, { signs: number[]; rules: number[]; controls: number[] }>>;

  getControlDiagrams(): Promise<ControlDiagram[]>;
  updateControlDiagram(id: number, data: Partial<InsertControlDiagram>): Promise<ControlDiagram | undefined>;
  getControls(filters?: { vehicle_type?: string; gearbox?: string; diagram_id?: number; search?: string; unreviewed?: boolean; missingImage?: boolean }): Promise<StudyControl[]>;
  getControlById(id: number): Promise<(StudyControl & { question_ids: number[] }) | undefined>;
  createControl(data: InsertStudyControl): Promise<StudyControl>;
  updateControl(id: number, data: Partial<InsertStudyControl>): Promise<StudyControl | undefined>;
  deleteControl(id: number): Promise<boolean>;
  getQuestionsForControl(controlId: number): Promise<Question[]>;
  linkControlQuestion(controlId: number, questionId: number): Promise<ControlQuestionLink>;
  unlinkControlQuestion(controlId: number, questionId: number): Promise<boolean>;
  getControlsForQuestion(questionId: number): Promise<StudyControl[]>;

  // Card-to-question link coverage (admin)
  getLinkCoverage(): Promise<LinkCoverage>;
  getUnlinkedQuestions(params: { category?: number; search?: string; offset: number; limit: number }): Promise<UnlinkedPage>;
  getUnlinkedCards(params: { type: 'sign' | 'rule' | 'control'; search?: string; offset: number; limit: number }): Promise<UnlinkedPage>;

  // Learner progress (server-synced mastery state)
  getLearnerProgress(mobileNumber: string, itemType: string): Promise<LearnerProgressRow[]>;
  upsertLearnerProgress(data: InsertLearnerProgress): Promise<LearnerProgressRow>;

  // Completed test history (server-synced by mobile number)
  getTestHistoryRuns(mobileNumber: string, limit: number): Promise<TestHistoryRunPayload[]>;
  upsertTestHistoryRun(data: InsertTestHistoryRun): Promise<void>;
  bulkImportControls(bundle: RawControlBundle): Promise<{ diagrams: number; controls: number; questions: number; links: number; skippedQuestions: number }>;
}

export class NeonDatabaseStorage implements IStorage {
  async getQuestions(): Promise<Question[]> {
    const data = await db.select().from(questions);
    // Cast to Question[] since the JSONB 'options' column matches the schema array structure 
    return data as unknown as Question[];
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    console.log('Creating question with data:', JSON.stringify(question, null, 2));
    const [newQuestion] = await db.insert(questions).values(question).returning();
    console.log('Created question result:', JSON.stringify(newQuestion, null, 2));
    return newQuestion as unknown as Question;
  }

  async updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined> {
    console.log(`Updating question ${id} with data:`, JSON.stringify(question, null, 2));
    const [updatedQuestion] = await db
      .update(questions)
      .set(question)
      .where(eq(questions.id, id))
      .returning();
    console.log('Updated question result:', JSON.stringify(updatedQuestion, null, 2));
    return updatedQuestion as unknown as Question | undefined;
  }

  async deleteQuestion(id: number): Promise<boolean> {
    const [deletedQuestion] = await db
      .delete(questions)
      .where(eq(questions.id, id))
      .returning();
    return !!deletedQuestion;
  }

  async bulkUploadQuestions(newQuestions: InsertQuestion[]): Promise<void> {
    if (newQuestions.length > 0) {
      await db.insert(questions).values(newQuestions);
    }
  }

  async bulkUpdateSource(ids: number[], sourceId: number | null): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(questions)
      .set({ source_id: sourceId })
      .where(inArray(questions.id, ids));
  }

  async bulkDeleteQuestions(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db
      .delete(questions)
      .where(inArray(questions.id, ids));
  }

  async bulkUpdateOfficial(ids: number[], isOfficial: boolean): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(questions)
      .set({ is_official: isOfficial })
      .where(inArray(questions.id, ids));
  }

  async bulkUpdateCategory(ids: number[], category: number): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(questions)
      .set({ category })
      .where(inArray(questions.id, ids));
  }

  async bulkUpdateDuplicate(ids: number[], isDuplicate: boolean): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(questions)
      .set({ is_duplicate: isDuplicate })
      .where(inArray(questions.id, ids));
  }

  async getSources(): Promise<Source[]> {
    const data = await db.select().from(sources);
    return data as Source[];
  }

  async getActiveSources(): Promise<Source[]> {
    const data = await db.select().from(sources).where(eq(sources.is_active, true));
    return data as Source[];
  }

  async createSource(source: InsertSource): Promise<Source> {
    const [newSource] = await db.insert(sources).values(source).returning();
    return newSource as Source;
  }

  async updateSource(id: number, source: Partial<InsertSource>): Promise<Source | undefined> {
    const [updatedSource] = await db
      .update(sources)
      .set(source)
      .where(eq(sources.id, id))
      .returning();
    return updatedSource as Source | undefined;
  }

  async toggleSourceActive(id: number, isActive: boolean): Promise<Source | undefined> {
    const [updatedSource] = await db
      .update(sources)
      .set({ is_active: isActive })
      .where(eq(sources.id, id))
      .returning();
    return updatedSource as Source | undefined;
  }

  async deleteSource(id: number): Promise<boolean> {
    const [deletedSource] = await db
      .delete(sources)
      .where(eq(sources.id, id))
      .returning();
    return !!deletedSource;
  }

  async getAccessCodes(): Promise<AccessCode[]> {
    const data = await db.select().from(accessCodes).orderBy(desc(accessCodes.created_at));
    return data as unknown as AccessCode[];
  }

  async getAccessCodeByCode(code: string): Promise<AccessCode | undefined> {
    const normalized = code.trim().toUpperCase();
    const rows = await db.select().from(accessCodes).where(eq(accessCodes.code, normalized));
    return (rows[0] as unknown as AccessCode) || undefined;
  }

  async getAccessCodeById(id: number): Promise<AccessCode | undefined> {
    const rows = await db.select().from(accessCodes).where(eq(accessCodes.id, id));
    return (rows[0] as unknown as AccessCode) || undefined;
  }

  async createAccessCode(data: InsertAccessCode): Promise<AccessCode> {
    const [row] = await db.insert(accessCodes).values({
      code: data.code.trim().toUpperCase(),
      type: data.type,
      mobile_number: data.mobile_number?.trim() ?? null,
      name: data.name?.trim() || null,
      surname: data.surname?.trim() || null,
      has_admin_access: data.has_admin_access ?? false,
      expires_at: data.expires_at ?? null,
      is_revoked: false,
    }).returning();
    return row as unknown as AccessCode;
  }

  async revokeAccessCode(id: number): Promise<AccessCode | undefined> {
    const [row] = await db
      .update(accessCodes)
      .set({ is_revoked: true })
      .where(eq(accessCodes.id, id))
      .returning();
    return row as unknown as AccessCode | undefined;
  }

  async deleteAccessCode(id: number): Promise<boolean> {
    const [row] = await db.delete(accessCodes).where(eq(accessCodes.id, id)).returning();
    return !!row;
  }

  async revokeAccessCodesByMobile(mobileNumber: string, exceptId?: number): Promise<number> {
    const conditions = [
      eq(accessCodes.mobile_number, mobileNumber),
      eq(accessCodes.is_revoked, false),
    ];
    if (exceptId !== undefined) conditions.push(ne(accessCodes.id, exceptId));
    const rows = await db
      .update(accessCodes)
      .set({ is_revoked: true })
      .where(and(...conditions))
      .returning({ id: accessCodes.id });
    return rows.length;
  }

  async deleteAccessCodesByMobile(mobileNumber: string): Promise<number> {
    const rows = await db
      .delete(accessCodes)
      .where(eq(accessCodes.mobile_number, mobileNumber))
      .returning({ id: accessCodes.id });
    return rows.length;
  }

  async getSuspendedMobile(mobileNumber: string): Promise<SuspendedMobile | undefined> {
    const [row] = await db
      .select()
      .from(suspendedMobiles)
      .where(eq(suspendedMobiles.mobile_number, mobileNumber));
    return row as unknown as SuspendedMobile | undefined;
  }

  async isMobileSuspended(mobileNumber: string): Promise<boolean> {
    return !!(await this.getSuspendedMobile(mobileNumber));
  }

  async suspendMobile(data: InsertSuspendedMobile): Promise<SuspendedMobile> {
    const [row] = await db
      .insert(suspendedMobiles)
      .values({
        mobile_number: data.mobile_number,
        reason: data.reason ?? null,
        suspended_by: data.suspended_by ?? null,
      })
      .onConflictDoUpdate({
        target: suspendedMobiles.mobile_number,
        set: {
          reason: data.reason ?? null,
          suspended_by: data.suspended_by ?? null,
          suspended_at: new Date(),
        },
      })
      .returning();
    return row as unknown as SuspendedMobile;
  }

  async unsuspendMobile(mobileNumber: string): Promise<boolean> {
    const [row] = await db
      .delete(suspendedMobiles)
      .where(eq(suspendedMobiles.mobile_number, mobileNumber))
      .returning({ mobile_number: suspendedMobiles.mobile_number });
    return !!row;
  }

  async getLearnerProfile(mobileNumber: string): Promise<LearnerProfile | undefined> {
    const [row] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.mobile_number, mobileNumber));
    return row as unknown as LearnerProfile | undefined;
  }

  async upsertLearnerProfile(data: InsertLearnerProfile): Promise<LearnerProfile> {
    const [row] = await db
      .insert(learnerProfiles)
      .values({
        mobile_number: data.mobile_number,
        name: data.name?.trim() || null,
        surname: data.surname?.trim() || null,
        updated_by: data.updated_by ?? null,
      })
      .onConflictDoUpdate({
        target: learnerProfiles.mobile_number,
        set: {
          name: data.name?.trim() || null,
          surname: data.surname?.trim() || null,
          updated_by: data.updated_by ?? null,
          updated_at: new Date(),
        },
      })
      .returning();
    return row as unknown as LearnerProfile;
  }

  async deleteLearnerProfile(mobileNumber: string): Promise<boolean> {
    const [row] = await db
      .delete(learnerProfiles)
      .where(eq(learnerProfiles.mobile_number, mobileNumber))
      .returning({ mobile_number: learnerProfiles.mobile_number });
    return !!row;
  }

  async getAdminUsers(): Promise<AdminUserSummary[]> {
    const [codes, suspensions, profiles, progressStats, testStats, latestTestNames] = await Promise.all([
      db.select().from(accessCodes).orderBy(desc(accessCodes.created_at)),
      db.select().from(suspendedMobiles),
      db.select().from(learnerProfiles),
      db
        .select({
          mobile_number: learnerProgress.mobile_number,
          total: count(),
          last_updated: sql<string | null>`to_char(max(${learnerProgress.updated_at}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
        })
        .from(learnerProgress)
        .groupBy(learnerProgress.mobile_number),
      db
        .select({
          mobile_number: learnerTestRuns.mobile_number,
          total: count(),
          last_finished: sql<string | null>`to_char(max(${learnerTestRuns.finished_at}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
        })
        .from(learnerTestRuns)
        .groupBy(learnerTestRuns.mobile_number),
      db
        .selectDistinctOn([learnerTestRuns.mobile_number], {
          mobile_number: learnerTestRuns.mobile_number,
          name: sql<string | null>`nullif(btrim(${learnerTestRuns.payload}->>'name'), '')`,
          surname: sql<string | null>`nullif(btrim(${learnerTestRuns.payload}->>'surname'), '')`,
        })
        .from(learnerTestRuns)
        .orderBy(learnerTestRuns.mobile_number, desc(learnerTestRuns.finished_at)),
    ]);

    const aggregates = new Map<
      string,
      {
        codes: AccessCode[];
        suspension?: SuspendedMobile;
        profile?: LearnerProfile;
        progress_count: number;
        test_count: number;
        progress_last: string | null;
        test_last: string | null;
        test_name: string | null;
        test_surname: string | null;
      }
    >();

    const getAggregate = (mobileNumber: string) => {
      let aggregate = aggregates.get(mobileNumber);
      if (!aggregate) {
        aggregate = {
          codes: [],
          progress_count: 0,
          test_count: 0,
          progress_last: null,
          test_last: null,
          test_name: null,
          test_surname: null,
        };
        aggregates.set(mobileNumber, aggregate);
      }
      return aggregate;
    };

    for (const code of codes) {
      const mobile = (code.mobile_number || '').trim();
      if (mobile) getAggregate(mobile).codes.push(code as unknown as AccessCode);
    }
    for (const suspension of suspensions) {
      getAggregate(suspension.mobile_number).suspension = suspension as unknown as SuspendedMobile;
    }
    for (const profile of profiles) {
      getAggregate(profile.mobile_number).profile = profile as unknown as LearnerProfile;
    }
    for (const row of progressStats) {
      const aggregate = getAggregate(row.mobile_number);
      aggregate.progress_count = Number(row.total);
      aggregate.progress_last = row.last_updated;
    }
    for (const row of testStats) {
      const aggregate = getAggregate(row.mobile_number);
      aggregate.test_count = Number(row.total);
      aggregate.test_last = row.last_finished;
    }
    for (const row of latestTestNames) {
      const aggregate = getAggregate(row.mobile_number);
      aggregate.test_name = row.name;
      aggregate.test_surname = row.surname;
    }

    const typeRank: Record<AccessCodeType, number> = {
      daily: 1,
      weekly: 2,
      monthly: 3,
      master: 4,
    };
    const now = Date.now();
    const toIso = (value: Date | string | null | undefined): string | null => {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    };

    const summaries: AdminUserSummary[] = [];
    for (const [mobileNumber, aggregate] of Array.from(aggregates.entries())) {
      const sortedCodes = [...aggregate.codes].sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
      const activeCodes = sortedCodes.filter(
        (code) => !code.is_revoked && (!code.expires_at || new Date(code.expires_at).getTime() > now)
      );
      const bestActive = [...activeCodes].sort(
        (a, b) =>
          typeRank[b.type as AccessCodeType] - typeRank[a.type as AccessCodeType] ||
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      )[0];
      const latestCode = sortedCodes[0];
      const reference = bestActive ?? latestCode;

      const latestNamedCode = sortedCodes.find(
        (code) => !!(code.name?.trim() || code.surname?.trim())
      );
      const codeName = latestNamedCode?.name?.trim() || null;
      const codeSurname = latestNamedCode?.surname?.trim() || null;
      const testName = aggregate.test_name?.trim() || null;
      const testSurname = aggregate.test_surname?.trim() || null;
      const hasTestName = !!(testName || testSurname);
      const codeNameAt = latestNamedCode
        ? new Date(latestNamedCode.created_at ?? 0).getTime()
        : 0;
      const testNameAt = aggregate.test_last
        ? new Date(aggregate.test_last).getTime()
        : 0;
      const useTestName = hasTestName && testNameAt > codeNameAt;

      // An admin-edited profile is the source of truth; names captured on an
      // access code or a test run are only fallbacks for learners never edited.
      const profileName = aggregate.profile?.name?.trim() || null;
      const profileSurname = aggregate.profile?.surname?.trim() || null;
      const useProfile = !!(profileName || profileSurname);

      let status: AdminUserStatus = 'no_access';
      if (aggregate.suspension) {
        status = 'suspended';
      } else if (bestActive) {
        status = 'active';
      } else if (latestCode) {
        if (latestCode.expires_at && new Date(latestCode.expires_at).getTime() <= now) {
          status = 'expired';
        } else if (latestCode.is_revoked) {
          status = 'revoked';
        }
      }

      const activityTimes = [
        ...sortedCodes.map((code) => new Date(code.created_at ?? 0).getTime()),
        aggregate.progress_last ? new Date(aggregate.progress_last).getTime() : 0,
        aggregate.test_last ? new Date(aggregate.test_last).getTime() : 0,
        aggregate.suspension ? new Date(aggregate.suspension.suspended_at).getTime() : 0,
      ].filter((time) => Number.isFinite(time) && time > 0);

      summaries.push({
        mobile_number: mobileNumber,
        name: useProfile ? profileName : useTestName ? testName : codeName,
        surname: useProfile ? profileSurname : useTestName ? testSurname : codeSurname,
        access_type: reference?.type ?? null,
        access_code: reference?.code ?? null,
        expires_at: toIso(reference?.expires_at),
        has_admin_access: reference?.has_admin_access ?? false,
        status,
        suspended: !!aggregate.suspension,
        suspended_at: toIso(aggregate.suspension?.suspended_at),
        suspension_reason: aggregate.suspension?.reason ?? null,
        code_count: aggregate.codes.length,
        active_code_count: activeCodes.length,
        progress_count: aggregate.progress_count,
        test_count: aggregate.test_count,
        last_activity_at: activityTimes.length ? new Date(Math.max(...activityTimes)).toISOString() : null,
      });
    }

    return summaries.sort((a, b) => {
      const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return bTime - aTime || a.mobile_number.localeCompare(b.mobile_number);
    });
  }

  async deleteUserData(mobileNumber: string): Promise<{ codes: number; progress: number; tests: number; suspension: boolean; profile: boolean }> {
    const codes = await this.deleteAccessCodesByMobile(mobileNumber);
    const progress = await db
      .delete(learnerProgress)
      .where(eq(learnerProgress.mobile_number, mobileNumber))
      .returning({ id: learnerProgress.id });
    const tests = await db
      .delete(learnerTestRuns)
      .where(eq(learnerTestRuns.mobile_number, mobileNumber))
      .returning({ id: learnerTestRuns.id });
    const suspension = await this.unsuspendMobile(mobileNumber);
    const profile = await this.deleteLearnerProfile(mobileNumber);
    return { codes, progress: progress.length, tests: tests.length, suspension, profile };
  }

  // === Road Signs study module ===

  async getSigns(filters?: { heading?: string; subheading?: string; search?: string; verified?: boolean; missingImage?: boolean }): Promise<StudySign[]> {
    const rows = await db.select().from(studySigns);
    let signs = rows as unknown as StudySign[];
    const f = filters || {};
    if (f.heading) signs = signs.filter((s) => s.heading === f.heading);
    if (f.subheading) signs = signs.filter((s) => s.subheading === f.subheading);
    if (typeof f.verified === 'boolean') signs = signs.filter((s) => !!s.is_verified_exam_question === f.verified);
    if (f.missingImage) {
      signs = signs.filter((s) => {
        const covered = new Set((s.images || []).map((i) => i.code));
        return (s.codes || []).some((c) => !covered.has(c));
      });
    }
    if (f.search) {
      const q = f.search.trim().toLowerCase();
      if (q) {
        signs = signs.filter((s) =>
          s.name.toLowerCase().includes(q) ||
          (s.codes || []).some((c) => c.toLowerCase().includes(q))
        );
      }
    }
    return signs.sort((a, b) => a.heading.localeCompare(b.heading) || a.subheading.localeCompare(b.subheading) || a.name.localeCompare(b.name));
  }

  async getSignById(id: number): Promise<(StudySign & { question_ids: number[] }) | undefined> {
    const rows = await db.select().from(studySigns).where(eq(studySigns.id, id));
    if (!rows[0]) return undefined;
    const links = await db.select().from(signQuestions).where(eq(signQuestions.sign_id, id));
    return { ...(rows[0] as unknown as StudySign), question_ids: links.map((l) => l.question_id) };
  }

  async createSign(data: InsertStudySign): Promise<StudySign> {
    const [row] = await db.insert(studySigns).values({
      heading: data.heading,
      subheading: data.subheading,
      name: data.name,
      codes: data.codes,
      images: data.images ?? [],
      where_text: data.where_text ?? null,
      purpose_text: data.purpose_text ?? null,
      action_text: data.action_text ?? null,
      short_meaning: data.short_meaning ?? null,
      short_action: data.short_action ?? null,
      short_reviewed: data.short_reviewed ?? false,
      needs_split: data.needs_split ?? false,
      is_verified_exam_question: data.is_verified_exam_question ?? false,
    }).returning();
    return row as unknown as StudySign;
  }

  async updateSign(id: number, data: Partial<InsertStudySign>): Promise<StudySign | undefined> {
    const [row] = await db
      .update(studySigns)
      .set({ ...data, updated_at: new Date() })
      .where(eq(studySigns.id, id))
      .returning();
    return (row as unknown as StudySign) || undefined;
  }

  /** Approve every drafted short text that is not approved yet. */
  async approveShortTextDrafts(): Promise<number> {
    const rows = await db
      .update(studySigns)
      .set({ short_reviewed: true, updated_at: new Date() })
      .where(and(
        eq(studySigns.short_reviewed, false),
        sql`trim(coalesce(${studySigns.short_meaning}, '')) <> ''`,
      ))
      .returning({ id: studySigns.id });
    return rows.length;
  }

  async deleteSign(id: number): Promise<boolean> {
    const [row] = await db.delete(studySigns).where(eq(studySigns.id, id)).returning();
    return !!row;
  }

  async bulkInsertSigns(rows: InsertStudySign[]): Promise<{ inserted: number; skipped: number }> {
    if (rows.length === 0) return { inserted: 0, skipped: 0 };
    const existing = await db.select().from(studySigns);
    const seen = new Set(existing.map((s) => `${s.heading}|||${s.name}`.toLowerCase()));
    const fresh = rows.filter((r) => {
      const key = `${r.heading}|||${r.name}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length > 0) {
      await db.insert(studySigns).values(fresh.map((r) => ({
        heading: r.heading,
        subheading: r.subheading,
        name: r.name,
        codes: r.codes,
        images: r.images ?? [],
        where_text: r.where_text ?? null,
        purpose_text: r.purpose_text ?? null,
        action_text: r.action_text ?? null,
        is_verified_exam_question: r.is_verified_exam_question ?? false,
      })));
    }
    return { inserted: fresh.length, skipped: rows.length - fresh.length };
  }

  async getQuestionsForSign(signId: number): Promise<Question[]> {
    const links = await db.select().from(signQuestions).where(eq(signQuestions.sign_id, signId));
    if (links.length === 0) return [];
    const ids = links.map((l) => l.question_id);
    const data = await db.select().from(questions).where(inArray(questions.id, ids));
    return data as unknown as Question[];
  }

  async linkSignQuestion(signId: number, questionId: number): Promise<SignQuestionLink> {
    const signRows = await db.select().from(studySigns).where(eq(studySigns.id, signId));
    if (!signRows[0]) throw new Error("Sign not found");
    const qRows = await db.select().from(questions).where(eq(questions.id, questionId));
    if (!qRows[0]) throw new Error("Question not found");
    const dup = await db.select().from(signQuestions).where(and(eq(signQuestions.sign_id, signId), eq(signQuestions.question_id, questionId)));
    if (dup[0]) return dup[0] as SignQuestionLink;
    const [row] = await db.insert(signQuestions).values({ sign_id: signId, question_id: questionId }).returning();
    return row as SignQuestionLink;
  }

  async unlinkSignQuestion(signId: number, questionId: number): Promise<boolean> {
    const [row] = await db
      .delete(signQuestions)
      .where(and(eq(signQuestions.sign_id, signId), eq(signQuestions.question_id, questionId)))
      .returning();
    return !!row;
  }

  // Remove a code from a sign record (drops its image mapping too;
  // image files stay on disk, same as sign delete).
  async removeSignCode(signId: number, code: string): Promise<StudySign | undefined> {
    const sign = await this.getSignById(signId);
    if (!sign) return undefined;
    if (!(sign.codes || []).includes(code)) return sign;
    return this.updateSign(signId, {
      codes: (sign.codes || []).filter((c) => c !== code),
      images: (sign.images || []).filter((i) => i.code !== code),
    });
  }

  // Detach one image mapping (file stays on disk). The code keeps its
  // empty slot, so the sign resurfaces in the reconcile needs list.
  async removeSignImage(signId: number, code: string): Promise<StudySign | undefined> {
    const sign = await this.getSignById(signId);
    if (!sign) return undefined;
    if (!(sign.images || []).some((i) => i.code === code)) return sign;
    return this.updateSign(signId, {
      images: (sign.images || []).filter((i) => i.code !== code),
    });
  }

  // === Rules of the Road study module ===

  async getRules(filters?: { code?: number; heading?: string; subheading?: string; search?: string; verified?: boolean; missingQuestion?: boolean; unreviewed?: boolean }): Promise<StudyRule[]> {
    let rules = (await db.select().from(studyRules)) as unknown as StudyRule[];
    const f = filters || {};
    // Code-expansion rule (spec Section 2) — applied server-side:
    //   1 (motorcycle) → tags 0,1   2 (light) → 0,2   3 (light+heavy) → 0,2,3
    if (f.code === 1 || f.code === 2 || f.code === 3) {
      const allowed = f.code === 1 ? [0, 1] : f.code === 2 ? [0, 2] : [0, 2, 3];
      rules = rules.filter((r) => (r.applicable_codes || []).some((c) => allowed.includes(c)));
    }
    if (f.heading) rules = rules.filter((r) => r.heading === f.heading);
    if (f.subheading) rules = rules.filter((r) => r.subheading === f.subheading);
    if (typeof f.verified === 'boolean') rules = rules.filter((r) => !!r.is_verified_exam_question === f.verified);
    if (f.unreviewed === true) rules = rules.filter((r) => !r.is_reviewed);
    if (f.missingQuestion) {
      // Rules with no linked question — separate join per rule is fine at this scale
      const allLinks = await db.select().from(ruleQuestions);
      const linked = new Set(allLinks.map((l) => l.rule_id));
      rules = rules.filter((r) => !linked.has(r.id));
    }
    if (f.search) {
      const q = f.search.trim().toLowerCase();
      if (q) {
        rules = rules.filter((r) =>
          r.body.toLowerCase().includes(q) ||
          (r.question || '').toLowerCase().includes(q) ||
          (r.title || '').toLowerCase().includes(q) ||
          r.section_ref.toLowerCase().includes(q) ||
          r.heading.toLowerCase().includes(q) ||
          r.subheading.toLowerCase().includes(q)
        );
      }
    }
    return rules.sort((a, b) => a.heading.localeCompare(b.heading) || a.subheading.localeCompare(b.subheading) || a.section_ref.localeCompare(b.section_ref));
  }

  async getRuleById(id: number): Promise<(StudyRule & { question_ids: number[] }) | undefined> {
    const rows = await db.select().from(studyRules).where(eq(studyRules.id, id));
    if (!rows[0]) return undefined;
    const links = await db.select().from(ruleQuestions).where(eq(ruleQuestions.rule_id, id));
    return { ...(rows[0] as unknown as StudyRule), question_ids: links.map((l) => l.question_id) };
  }

  async createRule(data: InsertStudyRule): Promise<StudyRule> {
    const [row] = await db.insert(studyRules).values({
      section_ref: data.section_ref,
      heading: data.heading,
      subheading: data.subheading,
      title: data.title ?? null,
      question: data.question ?? null,
      body: data.body,
      applicable_codes: data.applicable_codes,
      is_verified_exam_question: data.is_verified_exam_question ?? false,
      is_reviewed: data.is_reviewed ?? false,
    }).returning();
    return row as unknown as StudyRule;
  }

  async updateRule(id: number, data: Partial<InsertStudyRule>): Promise<StudyRule | undefined> {
    const [row] = await db
      .update(studyRules)
      .set({ ...data, updated_at: new Date() })
      .where(eq(studyRules.id, id))
      .returning();
    return (row as unknown as StudyRule) || undefined;
  }

  async deleteRule(id: number): Promise<boolean> {
    const [row] = await db.delete(studyRules).where(eq(studyRules.id, id)).returning();
    return !!row;
  }

  async bulkInsertRules(rows: InsertStudyRule[]): Promise<{ inserted: number; skipped: number }> {
    if (rows.length === 0) return { inserted: 0, skipped: 0 };
    const existing = await db.select().from(studyRules);
    const seen = new Set(existing.map((r) => `${r.section_ref}|||${r.body}`.toLowerCase()));
    const fresh = rows.filter((r) => {
      const key = `${r.section_ref}|||${r.body}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length > 0) {
      await db.insert(studyRules).values(fresh.map((r) => ({
        section_ref: r.section_ref,
        heading: r.heading,
        subheading: r.subheading,
        title: r.title ?? null,
        question: r.question ?? null,
        body: r.body,
        applicable_codes: r.applicable_codes,
        is_verified_exam_question: r.is_verified_exam_question ?? false,
        is_reviewed: false, // imports always land unreviewed
      })));
    }
    return { inserted: fresh.length, skipped: rows.length - fresh.length };
  }

  async getQuestionsForRule(ruleId: number): Promise<Question[]> {
    const links = await db.select().from(ruleQuestions).where(eq(ruleQuestions.rule_id, ruleId));
    if (links.length === 0) return [];
    const ids = links.map((l) => l.question_id);
    const data = await db.select().from(questions).where(inArray(questions.id, ids));
    return data as unknown as Question[];
  }

  async getAllRuleQuestionLinks(): Promise<RuleQuestionLink[]> {
    return db.select().from(ruleQuestions) as unknown as Promise<RuleQuestionLink[]>;
  }

  async linkRuleQuestion(ruleId: number, questionId: number): Promise<RuleQuestionLink> {
    const rRows = await db.select().from(studyRules).where(eq(studyRules.id, ruleId));
    if (!rRows[0]) throw new Error("Rule not found");
    const qRows = await db.select().from(questions).where(eq(questions.id, questionId));
    if (!qRows[0]) throw new Error("Question not found");
    const dup = await db.select().from(ruleQuestions).where(and(eq(ruleQuestions.rule_id, ruleId), eq(ruleQuestions.question_id, questionId)));
    if (dup[0]) return dup[0] as RuleQuestionLink;
    const [row] = await db.insert(ruleQuestions).values({ rule_id: ruleId, question_id: questionId }).returning();
    return row as RuleQuestionLink;
  }

  async unlinkRuleQuestion(ruleId: number, questionId: number): Promise<boolean> {
    const [row] = await db
      .delete(ruleQuestions)
      .where(and(eq(ruleQuestions.rule_id, ruleId), eq(ruleQuestions.question_id, questionId)))
      .returning();
    return !!row;
  }

  async getSignsForQuestion(questionId: number): Promise<StudySign[]> {
    const links = await db.select().from(signQuestions).where(eq(signQuestions.question_id, questionId));
    if (links.length === 0) return [];
    const signIds = links.map((l) => l.sign_id);
    const data = await db.select().from(studySigns).where(inArray(studySigns.id, signIds));
    return data as unknown as StudySign[];
  }

  async getRulesForQuestion(questionId: number): Promise<StudyRule[]> {
    const links = await db.select().from(ruleQuestions).where(eq(ruleQuestions.question_id, questionId));
    if (links.length === 0) return [];
    const ruleIds = links.map((l) => l.rule_id);
    const data = await db.select().from(studyRules).where(inArray(studyRules.id, ruleIds));
    return data as unknown as StudyRule[];
  }

  async getCardLinksForQuestions(ids: number[]): Promise<Record<number, { signs: number[]; rules: number[]; controls: number[] }>> {
    const unique = Array.from(new Set(ids));
    const result: Record<number, { signs: number[]; rules: number[]; controls: number[] }> = {};
    for (const id of unique) result[id] = { signs: [], rules: [], controls: [] };
    if (unique.length === 0) return result;

    const [signRows, ruleRows, controlRows] = await Promise.all([
      db.select().from(signQuestions).where(inArray(signQuestions.question_id, unique)),
      db.select().from(ruleQuestions).where(inArray(ruleQuestions.question_id, unique)),
      db.select().from(controlQuestions).where(inArray(controlQuestions.question_id, unique)),
    ]);

    for (const row of signRows) result[row.question_id]?.signs.push(row.sign_id);
    for (const row of ruleRows) result[row.question_id]?.rules.push(row.rule_id);
    for (const row of controlRows) result[row.question_id]?.controls.push(row.control_id);

    for (const entry of Object.values(result)) {
      entry.signs.sort((a, b) => a - b);
      entry.rules.sort((a, b) => a - b);
      entry.controls.sort((a, b) => a - b);
    }

    return result;
  }

  // === Vehicle Controls study module ===

  private controlCodesForDiagram(d: ControlDiagram): number[] {
    if (d.vehicle_type === 'motorcycle') return [1];
    if (d.vehicle_type === 'lmv') return [2, 3];
    return [3]; // hmv
  }

  async getControlDiagrams(): Promise<ControlDiagram[]> {
    const rows = await db.select().from(controlDiagrams);
    return (rows as unknown as ControlDiagram[]).sort((a, b) =>
      a.vehicle_type.localeCompare(b.vehicle_type) || (a.gearbox || '').localeCompare(b.gearbox || ''));
  }

  async updateControlDiagram(id: number, data: Partial<InsertControlDiagram>): Promise<ControlDiagram | undefined> {
    const patch: Record<string, unknown> = {};
    if (data.vehicle_type !== undefined) patch.vehicle_type = data.vehicle_type;
    if (data.gearbox !== undefined) patch.gearbox = data.gearbox;
    if (data.label !== undefined) patch.label = data.label;
    if (data.image_url !== undefined) patch.image_url = data.image_url;
    if (data.is_inferred !== undefined) patch.is_inferred = data.is_inferred;
    if (Object.keys(patch).length === 0) {
      const rows = await db.select().from(controlDiagrams).where(eq(controlDiagrams.id, id));
      return (rows[0] as unknown as ControlDiagram) || undefined;
    }
    const [row] = await db
      .update(controlDiagrams)
      .set(patch as any)
      .where(eq(controlDiagrams.id, id))
      .returning();
    return (row as unknown as ControlDiagram) || undefined;
  }

  async getControls(filters?: { vehicle_type?: string; gearbox?: string; diagram_id?: number; search?: string; unreviewed?: boolean }): Promise<StudyControl[]> {
    const all = (await db.select().from(studyControls)) as unknown as StudyControl[];
    const diagrams = await this.getControlDiagrams();
    const byId = new Map(diagrams.map((d) => [d.id, d]));
    let items = all;

    if (filters?.vehicle_type) {
      items = items.filter((c) => byId.get(c.diagram_id)?.vehicle_type === filters.vehicle_type);
    }
    // Gearbox ignored/optional for motorcycle, required for lmv/hmv
    if (filters?.gearbox && filters.vehicle_type !== 'motorcycle') {
      items = items.filter((c) => byId.get(c.diagram_id)?.gearbox === filters.gearbox);
    }
    if (filters?.diagram_id) items = items.filter((c) => c.diagram_id === filters.diagram_id);
    if (filters?.unreviewed) items = items.filter((c) => !c.is_reviewed);
    if (filters?.search) {
      const q = filters.search.trim().toLowerCase();
      if (q) {
        items = items.filter((c) =>
          c.component_name.toLowerCase().includes(q) ||
          String(c.component_number ?? '').includes(q) ||
          (c.function_notes || '').toLowerCase().includes(q));
      }
    }
    return items.sort((a, b) => {
      const da = byId.get(a.diagram_id);
      const db2 = byId.get(b.diagram_id);
      return ((da?.vehicle_type || '') + (da?.gearbox || '')).localeCompare((db2?.vehicle_type || '') + (db2?.gearbox || '')) ||
        (a.component_number ?? 999) - (b.component_number ?? 999) ||
        a.component_name.localeCompare(b.component_name);
    });
  }

  async getControlById(id: number): Promise<(StudyControl & { question_ids: number[] }) | undefined> {
    const rows = await db.select().from(studyControls).where(eq(studyControls.id, id));
    if (!rows[0]) return undefined;
    const links = await db.select().from(controlQuestions).where(eq(controlQuestions.control_id, id));
    return { ...(rows[0] as unknown as StudyControl), question_ids: links.map((l) => l.question_id) };
  }

  async createControl(data: InsertStudyControl): Promise<StudyControl> {
    const [diag] = await db.select().from(controlDiagrams).where(eq(controlDiagrams.id, data.diagram_id));
    const codes = diag ? this.controlCodesForDiagram(diag as unknown as ControlDiagram) : [];
    const [row] = await db.insert(studyControls).values({
      diagram_id: data.diagram_id,
      component_number: data.component_number ?? null,
      component_name: data.component_name,
      function_notes: data.function_notes ?? null,
      applicable_codes: data.applicable_codes ?? codes,
      is_verified_exam_question: data.is_verified_exam_question ?? false,
      is_reviewed: data.is_reviewed ?? false,
    }).returning();
    return row as unknown as StudyControl;
  }

  async updateControl(id: number, data: Partial<InsertStudyControl>): Promise<StudyControl | undefined> {
    let codes = data.applicable_codes;
    if (data.diagram_id) {
      const [diag] = await db.select().from(controlDiagrams).where(eq(controlDiagrams.id, data.diagram_id));
      if (diag) codes = this.controlCodesForDiagram(diag as unknown as ControlDiagram);
    }
    const [row] = await db
      .update(studyControls)
      .set({ ...data, ...(codes ? { applicable_codes: codes } : {}), updated_at: new Date() })
      .where(eq(studyControls.id, id))
      .returning();
    return (row as unknown as StudyControl) || undefined;
  }

  async deleteControl(id: number): Promise<boolean> {
    const [row] = await db.delete(studyControls).where(eq(studyControls.id, id)).returning();
    return !!row;
  }

  async getQuestionsForControl(controlId: number): Promise<Question[]> {
    const links = await db.select().from(controlQuestions).where(eq(controlQuestions.control_id, controlId));
    if (links.length === 0) return [];
    const ids = links.map((l) => l.question_id);
    const data = await db.select().from(questions).where(inArray(questions.id, ids));
    return data as unknown as Question[];
  }

  async linkControlQuestion(controlId: number, questionId: number): Promise<ControlQuestionLink> {
    const cRows = await db.select().from(studyControls).where(eq(studyControls.id, controlId));
    if (!cRows[0]) throw new Error("Control not found");
    const qRows = await db.select().from(questions).where(eq(questions.id, questionId));
    if (!qRows[0]) throw new Error("Question not found");
    const dup = await db.select().from(controlQuestions).where(and(eq(controlQuestions.control_id, controlId), eq(controlQuestions.question_id, questionId)));
    if (dup[0]) return dup[0] as ControlQuestionLink;
    const [row] = await db.insert(controlQuestions).values({ control_id: controlId, question_id: questionId }).returning();
    return row as ControlQuestionLink;
  }

  async unlinkControlQuestion(controlId: number, questionId: number): Promise<boolean> {
    const [row] = await db
      .delete(controlQuestions)
      .where(and(eq(controlQuestions.control_id, controlId), eq(controlQuestions.question_id, questionId)))
      .returning();
    return !!row;
  }

  async getControlsForQuestion(questionId: number): Promise<StudyControl[]> {
    const links = await db.select().from(controlQuestions).where(eq(controlQuestions.question_id, questionId));
    if (links.length === 0) return [];
    const ids = links.map((l) => l.control_id);
    const data = await db.select().from(studyControls).where(inArray(studyControls.id, ids));
    return data as unknown as StudyControl[];
  }

  // === Card-to-question link coverage (admin) ===

  private missingLinkForQuestion(category: number) {
    const table = category === 1 ? ruleQuestions : category === 2 ? signQuestions : controlQuestions;
    const column = category === 1 ? ruleQuestions.question_id : category === 2 ? signQuestions.question_id : controlQuestions.question_id;
    return notExists(db.select({ id: table.id }).from(table).where(eq(column, questions.id)));
  }

  async getLinkCoverage(): Promise<LinkCoverage> {
    const countValue = (rows: { value: number | string }[]) => Number(rows[0]?.value ?? 0);
    const [
      questionTotals,
      unlinkedRuleQuestions,
      unlinkedSignQuestions,
      unlinkedControlQuestions,
      signCards,
      ruleCards,
      controlCards,
      linkedSignCards,
      linkedRuleCards,
      linkedControlCards,
    ] = await Promise.all([
      db.select({ category: questions.category, value: count() }).from(questions).groupBy(questions.category),
      db.select({ value: count() }).from(questions).where(and(eq(questions.category, 1), this.missingLinkForQuestion(1))),
      db.select({ value: count() }).from(questions).where(and(eq(questions.category, 2), this.missingLinkForQuestion(2))),
      db.select({ value: count() }).from(questions).where(and(eq(questions.category, 3), this.missingLinkForQuestion(3))),
      db.select({ value: count() }).from(studySigns),
      db.select({ value: count() }).from(studyRules),
      db.select({ value: count() }).from(studyControls),
      db.select({ value: countDistinct(signQuestions.sign_id) }).from(signQuestions),
      db.select({ value: countDistinct(ruleQuestions.rule_id) }).from(ruleQuestions),
      db.select({ value: countDistinct(controlQuestions.control_id) }).from(controlQuestions),
    ]);

    const totals = new Map(questionTotals.map((row) => [Number(row.category), Number(row.value)]));
    const module = (category: number, unlinkedRows: { value: number | string }[], cards: { value: number | string }[], linkedCards: { value: number | string }[]): LinkCoverageModule => {
      const total = totals.get(category) ?? 0;
      return {
        questions: { total, linked: Math.max(0, total - countValue(unlinkedRows)) },
        cards: { total: countValue(cards), linked: countValue(linkedCards) },
      };
    };

    return {
      rules: module(1, unlinkedRuleQuestions, ruleCards, linkedRuleCards),
      signs: module(2, unlinkedSignQuestions, signCards, linkedSignCards),
      controls: module(3, unlinkedControlQuestions, controlCards, linkedControlCards),
    };
  }

  async getUnlinkedQuestions({ category, search, offset, limit }: { category?: number; search?: string; offset: number; limit: number }): Promise<UnlinkedPage> {
    const categories = category === 1 || category === 2 || category === 3 ? [category] : [1, 2, 3];
    let where = or(...categories.map((c) => and(eq(questions.category, c), this.missingLinkForQuestion(c))))!;
    const term = search?.trim();
    if (term) {
      const pattern = `%${term}%`;
      where = and(
        where,
        or(
          ilike(questions.question_text, pattern),
          sql`CAST(${questions.question_number} AS TEXT) ILIKE ${pattern}`
        )
      )!;
    }

    const [rows, totals] = await Promise.all([
      db
        .select({
          id: questions.id,
          question_number: questions.question_number,
          question_text: questions.question_text,
          category: questions.category,
        })
        .from(questions)
        .where(where)
        .orderBy(questions.category, questions.question_number)
        .offset(offset)
        .limit(limit),
      db.select({ value: count() }).from(questions).where(where),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        label: row.question_text,
        question_number: row.question_number,
        category: row.category,
      })),
      total: Number(totals[0]?.value ?? 0),
    };
  }

  async getUnlinkedCards({ type, search, offset, limit }: { type: 'sign' | 'rule' | 'control'; search?: string; offset: number; limit: number }): Promise<UnlinkedPage> {
    const term = search?.trim();
    const pattern = term ? `%${term}%` : '';

    if (type === 'sign') {
      const noLink = notExists(
        db.select({ id: signQuestions.id }).from(signQuestions).where(eq(signQuestions.sign_id, studySigns.id))
      );
      const where = pattern
        ? and(noLink, or(ilike(studySigns.name, pattern), ilike(studySigns.heading, pattern)))!
        : noLink;
      const [rows, totals] = await Promise.all([
        db
          .select({ id: studySigns.id, name: studySigns.name, heading: studySigns.heading })
          .from(studySigns)
          .where(where)
          .orderBy(studySigns.heading, studySigns.name)
          .offset(offset)
          .limit(limit),
        db.select({ value: count() }).from(studySigns).where(where),
      ]);
      return {
        items: rows.map((row) => ({ id: row.id, label: row.name, heading: row.heading })),
        total: Number(totals[0]?.value ?? 0),
      };
    }

    if (type === 'rule') {
      const noLink = notExists(
        db.select({ id: ruleQuestions.id }).from(ruleQuestions).where(eq(ruleQuestions.rule_id, studyRules.id))
      );
      const where = pattern
        ? and(noLink, or(ilike(studyRules.title, pattern), ilike(studyRules.body, pattern), ilike(studyRules.heading, pattern)))!
        : noLink;
      const [rows, totals] = await Promise.all([
        db
          .select({ id: studyRules.id, title: studyRules.title, body: studyRules.body, heading: studyRules.heading })
          .from(studyRules)
          .where(where)
          .orderBy(studyRules.heading, studyRules.section_ref)
          .offset(offset)
          .limit(limit),
        db.select({ value: count() }).from(studyRules).where(where),
      ]);
      return {
        items: rows.map((row) => ({
          id: row.id,
          label: (row.title || '').trim() || row.body,
          heading: row.heading,
        })),
        total: Number(totals[0]?.value ?? 0),
      };
    }

    const noLink = notExists(
      db.select({ id: controlQuestions.id }).from(controlQuestions).where(eq(controlQuestions.control_id, studyControls.id))
    );
    const where = pattern ? and(noLink, ilike(studyControls.component_name, pattern))! : noLink;
    const [rows, totals] = await Promise.all([
      db
        .select({
          id: studyControls.id,
          label: studyControls.component_name,
          heading: controlDiagrams.label,
          component_number: studyControls.component_number,
        })
        .from(studyControls)
        .leftJoin(controlDiagrams, eq(controlDiagrams.id, studyControls.diagram_id))
        .where(where)
        .orderBy(controlDiagrams.label, studyControls.component_number)
        .offset(offset)
        .limit(limit),
      db.select({ value: count() }).from(studyControls).where(where),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        label: row.label,
        heading: row.heading ?? 'Controls',
      })),
      total: Number(totals[0]?.value ?? 0),
    };
  }

  // === Learner progress (server-synced mastery state) ===

  async getLearnerProgress(mobileNumber: string, itemType: string): Promise<LearnerProgressRow[]> {
    const rows = await db.select().from(learnerProgress).where(
      and(
        eq(learnerProgress.mobile_number, mobileNumber),
        eq(learnerProgress.item_type, itemType)
      )
    );
    return rows as unknown as LearnerProgressRow[];
  }

  async upsertLearnerProgress(data: InsertLearnerProgress): Promise<LearnerProgressRow> {
    const [existing] = await db.select().from(learnerProgress).where(
      and(
        eq(learnerProgress.mobile_number, data.mobile_number),
        eq(learnerProgress.item_type, data.item_type),
        eq(learnerProgress.item_id, data.item_id)
      )
    );

    if (existing) {
      const [row] = await db
        .update(learnerProgress)
        .set({
          status: data.status,
          correct: data.correct,
          incorrect: data.incorrect,
          last_rating: data.last_rating ?? null,
          last_seen_at: data.last_seen_at ? new Date(data.last_seen_at) : null,
          updated_at: new Date(),
        })
        .where(eq(learnerProgress.id, existing.id))
        .returning();
      return row as unknown as LearnerProgressRow;
    }

    const [row] = await db.insert(learnerProgress).values({
      mobile_number: data.mobile_number,
      item_type: data.item_type,
      item_id: data.item_id,
      status: data.status,
      correct: data.correct,
      incorrect: data.incorrect,
      last_rating: data.last_rating ?? null,
      last_seen_at: data.last_seen_at ? new Date(data.last_seen_at) : null,
    }).returning();
    return row as unknown as LearnerProgressRow;
  }

  async getTestHistoryRuns(mobileNumber: string, limit: number): Promise<TestHistoryRunPayload[]> {
    const rows = await db
      .select()
      .from(learnerTestRuns)
      .where(eq(learnerTestRuns.mobile_number, mobileNumber))
      .orderBy(desc(learnerTestRuns.finished_at))
      .limit(limit);
    return rows.map((row) => row.payload as TestHistoryRunPayload);
  }

  async upsertTestHistoryRun(data: InsertTestHistoryRun): Promise<void> {
    await db
      .insert(learnerTestRuns)
      .values({
        mobile_number: data.mobile_number,
        run_id: data.run_id,
        finished_at: data.finished_at,
        payload: data.payload,
      })
      .onConflictDoUpdate({
        target: [learnerTestRuns.mobile_number, learnerTestRuns.run_id],
        set: {
          finished_at: data.finished_at,
          payload: data.payload,
          updated_at: new Date(),
        },
      });
  }

  async bulkImportControls(bundle: RawControlBundle): Promise<{ diagrams: number; controls: number; questions: number; links: number; skippedQuestions: number }> {
    // Pass 1: diagrams
    const existingDiagrams = (await db.select().from(controlDiagrams)) as unknown as ControlDiagram[];
    const diagramKeyToId = new Map<string, number>();
    for (const d of existingDiagrams) {
      const key = `${d.vehicle_type}|${d.gearbox ?? ''}`;
      diagramKeyToId.set(key, d.id);
    }
    let diagInserted = 0;
    for (const d of bundle.control_diagrams) {
      const key = `${d.vehicle_type}|${d.gearbox ?? ''}`;
      if (diagramKeyToId.has(key)) continue;
      const [row] = await db.insert(controlDiagrams).values({
        vehicle_type: d.vehicle_type,
        gearbox: d.gearbox ?? null,
        label: d.label,
        image_url: d.image_url ?? null,
        is_inferred: d.is_inferred ?? false,
      }).returning();
      diagramKeyToId.set(key, (row as any).id);
      diagInserted++;
    }

    // Pass 1b: controls, resolving diagram_key to real ids
    const existingControls = (await db.select().from(studyControls)) as unknown as StudyControl[];
    const controlKey = (diagramId: number, compNum: number | null | undefined, name: string) => `${diagramId}#${compNum ?? ''}#${name}`;
    const seenControls = new Set(existingControls.map((c) => controlKey(c.diagram_id, c.component_number, c.component_name)));
    const controlByDiagramAndNumber = new Map<string, number>();
    for (const c of existingControls) controlByDiagramAndNumber.set(`${c.diagram_id}#${c.component_number ?? ''}`, c.id);
    let controlInserted = 0;
    for (const c of bundle.study_controls) {
      const diagKey = bundle.control_diagrams.find((d) => d.key === c.diagram_key);
      if (!diagKey) continue;
      const diagramId = diagramKeyToId.get(`${diagKey.vehicle_type}|${diagKey.gearbox ?? ''}`);
      if (!diagramId) continue;
      const dedupeKey = controlKey(diagramId, c.component_number ?? null, c.component_name);
      if (!seenControls.has(dedupeKey)) {
        const [row] = await db.insert(studyControls).values({
          diagram_id: diagramId,
          component_number: c.component_number ?? null,
          component_name: c.component_name,
          function_notes: c.function_notes ?? null,
          // Numeric vehicle codes (1/2/3), not the question license_code text format.
          applicable_codes: diagKey.vehicle_type === 'motorcycle' ? [1] : diagKey.vehicle_type === 'lmv' ? [2, 3] : [3],
          is_verified_exam_question: false,
          is_reviewed: false,
        }).returning();
        seenControls.add(dedupeKey);
        controlByDiagramAndNumber.set(`${diagramId}#${c.component_number ?? ''}`, (row as any).id);
        controlInserted++;
      } else {
        const id = controlByDiagramAndNumber.get(`${diagramId}#${c.component_number ?? ''}`);
        if (id) controlByDiagramAndNumber.set(`${diagramId}#${c.component_number ?? ''}`, id);
      }
    }

    // Pass 2: sample questions (shuffle options, keep correct marker), then links
    const allQuestions = (await db.select().from(questions)) as unknown as Question[];
    const existingQ = new Set(allQuestions.map((q) => `${q.question_text}#${q.license_code}#${q.category}`));
    let qInserted = 0;
    let skippedQuestions = 0;
    let linksAdded = 0;
    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const sq of bundle.sample_questions || []) {
      const diagKey = bundle.control_diagrams.find((d) => d.key === sq.diagram_key);
      // Long-form license codes only ("01"/"02"/"03"); short codes are legacy.
      const license = diagKey?.vehicle_type === 'motorcycle' ? '01' : diagKey?.vehicle_type === 'lmv' ? '02' : diagKey?.vehicle_type === 'hmv' ? '03' : '02';
      const dedupe = `${sq.question_text}#${license}#3`;
      if (existingQ.has(dedupe)) { skippedQuestions++; continue; }
      const diagRealId = diagKey ? diagramKeyToId.get(`${diagKey.vehicle_type}|${diagKey.gearbox ?? ''}`) : undefined;
      const targetIds: number[] = [];
      for (const compNum of sq.linked_component_numbers || []) {
        if (diagRealId) {
          const cid = controlByDiagramAndNumber.get(`${diagRealId}#${compNum}`);
          if (cid) targetIds.push(cid);
        }
      }
      // Shuffle options, keep correct flag on the right text
      const correctText = sq.options[sq.correct_index];
      const others = sq.options.filter((_, i) => i !== sq.correct_index);
      const shuffled = [correctText, ...others].sort(() => Math.random() - 0.5);
      const options = shuffled.map((answer_text, i) => ({
        answer_number: LETTERS[i] || String(i + 1),
        answer_text,
        correct_answer: answer_text === correctText,
      }));
      let qNum = allQuestions.length > 0 ? Math.max(...allQuestions.map((x) => x.question_number || 0)) + qInserted + 1 : qInserted + 1;
      const [qRow] = await db.insert(questions).values({
        question_number: qNum,
        question_text: sq.question_text,
        category: 3,
        license_code: license,
        contains_image: false,
        image_link: null,
        options,
        source_id: null,
        is_duplicate: false,
        is_official: false,
        is_reviewed: false,
      }).returning();
      allQuestions.push(qRow as any);
      existingQ.add(dedupe);
      qInserted++;
      for (const cid of targetIds) {
        const dup = await db.select().from(controlQuestions).where(and(eq(controlQuestions.control_id, cid), eq(controlQuestions.question_id, (qRow as any).id)));
        if (dup[0]) continue;
        await db.insert(controlQuestions).values({ control_id: cid, question_id: (qRow as any).id });
        linksAdded++;
      }
    }
    return { diagrams: diagInserted, controls: controlInserted, questions: qInserted, links: linksAdded, skippedQuestions };
  }
}

export const storage = new NeonDatabaseStorage();