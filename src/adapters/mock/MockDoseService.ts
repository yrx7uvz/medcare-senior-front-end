import type { DoseService } from '../../services/types';
import type { AlertView, DoseView } from '../../types/views';
import { httpError } from '../../services/errors';
import { getNow } from '../../lib/clock';
import { parseDateTime, toDateKey, toDateTimeKey } from '../../lib/date';
import { TOLERANCE_MAX, TOLERANCE_MIN, isConfirmed, isMissed, statusOnConfirm } from '../../lib/doseRules';
import { getDb, mutateDb } from '../../mocks/db';
import { toDoseView } from './doseViews';
import { simulate } from './simulate';

const byTime = (a: DoseView, b: DoseView) => a.scheduledAt.localeCompare(b.scheduledAt);

export const mockDoseService: DoseService = {
  listForDay: (filter, day) =>
    simulate(() => {
      const now = getNow();
      return getDb()
        .doses.filter((d) => d.scheduledAt.startsWith(day) && (filter === 'ALL' || d.elderId === filter))
        .map((d) => toDoseView(d, now))
        .sort(byTime);
    }),

  get: (id) =>
    simulate(() => {
      const dose = getDb().doses.find((d) => d.id === id);
      if (!dose) throw httpError(404, 'Dose não encontrada.');
      return toDoseView(dose, getNow());
    }),

  /** PUT /api/doses/{id}/confirmar — RN08 e RN14. */
  confirm: (id) =>
    simulate(() => {
      const now = getNow();
      const db = getDb();
      const index = db.doses.findIndex((d) => d.id === id);
      if (index < 0) throw httpError(404, 'Dose não encontrada.');
      const current = db.doses[index];
      const view = toDoseView(current, now);
      if (view.confirmability === 'JA_REGISTRADA') throw httpError(409, 'Esta dose já foi registrada.', 'DOSE_JA_REGISTRADA');
      if (view.confirmability === 'MUITO_CEDO') throw httpError(409, 'Ainda é cedo para confirmar esta dose.', 'DOSE_MUITO_CEDO');
      if (view.confirmability === 'ENCERRADA') throw httpError(409, 'O prazo para confirmar esta dose terminou.', 'DOSE_ENCERRADA');
      // Dose imutável: substitui por uma nova versão, nunca altera a anterior.
      const next = {
        ...current,
        status: statusOnConfirm(parseDateTime(current.scheduledAt), now, db.toleranceMinutes),
        confirmedAt: toDateTimeKey(now),
      };
      mutateDb((d) => {
        d.doses[index] = next;
      });
      return toDoseView(next, now);
    }, 350),

  listHistory: (q) =>
    simulate(() => {
      const now = getNow();
      const nowKey = toDateTimeKey(now);
      return getDb()
        .doses.filter((d) => {
          const day = d.scheduledAt.slice(0, 10);
          if (day < q.from || day > q.to) return false;
          if (q.elder !== 'ALL' && d.elderId !== q.elder) return false;
          return d.status !== 'PENDENTE' || d.scheduledAt <= nowKey;
        })
        .map((d) => toDoseView(d, now))
        .filter((v) => {
          switch (q.status) {
            case 'CONFIRMED': return isConfirmed(v.status);
            case 'MISSED': return isMissed(v.status);
            case 'LATE': return v.status === 'CONFIRMADA_COM_ATRASO';
            default: return true;
          }
        })
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    }),

  listAlerts: () =>
    simulate(() => {
      const now = getNow();
      const today = toDateKey(now);
      const db = getDb();
      return db.doses
        .filter((d) => d.scheduledAt.startsWith(today) && d.status === 'PENDENTE')
        .map((d) => toDoseView(d, now))
        .filter((v) => v.status === 'ATRASADA' || v.status === 'NAO_TOMADA')
        .map<AlertView>((v) => ({
          doseId: v.id,
          elderId: v.elderId,
          elderName: v.elderName,
          medicationName: v.medication.name,
          dosage: v.medication.dosage,
          scheduledAt: v.scheduledAt,
          status: v.status as 'ATRASADA' | 'NAO_TOMADA',
        }))
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    }, -150),

  getTolerance: () => simulate(() => getDb().toleranceMinutes),

  setTolerance: (minutes) =>
    simulate(() => {
      if (!Number.isInteger(minutes) || minutes < TOLERANCE_MIN || minutes > TOLERANCE_MAX) {
        throw httpError(400, `A tolerância deve ficar entre ${TOLERANCE_MIN} e ${TOLERANCE_MAX} minutos.`);
      }
      mutateDb((db) => {
        db.toleranceMinutes = minutes;
      });
      return minutes;
    }),
};
