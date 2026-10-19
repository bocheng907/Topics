import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { medicationProgress, taipeiDateKey } from './medicationProgress';

type State = { scope: string; prescriptions: number; reminders: (DocumentData & {id: string})[]; logs: DocumentData[]; loaded: number; error: boolean };
const empty: State = { scope: '', prescriptions: 0, reminders: [], logs: [], loaded: 0, error: false };

export function useMedicationProgress(patientId?: string | null) {
  const [dateKey, setDateKey] = useState(taipeiDateKey);
  const [state, setState] = useState<State>(empty);
  const scope = `${patientId ?? ''}:${dateKey}`;
  if (state.scope !== scope) setState({ ...empty, scope });
  useEffect(() => {
    const timer = setInterval(() => setDateKey(taipeiDateKey()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!patientId) return;
    let active = true;
    const fail = () => { if (active) setState(s => ({ ...s, error: true })); };
    const unsubscribers = [
      onSnapshot(query(collection(db, 'prescriptions'), where('patientId', '==', patientId)), snap => {
        if (active) setState(s => ({ ...s, prescriptions: snap.size, loaded: s.loaded | 1 }));
      }, fail),
      onSnapshot(query(collection(db, 'medication_reminders'), where('patientId', '==', patientId), where('enabled', '==', true)), snap => {
        if (active) setState(s => ({ ...s, reminders: snap.docs.map(d => ({ ...d.data(), id: d.id })), loaded: s.loaded | 2 }));
      }, fail),
      onSnapshot(query(collection(db, 'medication_logs'), where('patientId', '==', patientId), where('dateKey', '==', dateKey)), snap => {
        if (active) setState(s => ({ ...s, logs: snap.docs.map(d => d.data()), loaded: s.loaded | 4 }));
      }, fail),
    ];
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [patientId, dateKey, scope]);
  const current = state.scope === scope && patientId ? state : empty;
  return { ...medicationProgress(current.reminders, current.logs, dateKey),
    prescriptionCount: current.prescriptions, loading: current.loaded !== 7, error: current.error };
}
