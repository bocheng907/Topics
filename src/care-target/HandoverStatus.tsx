import { db } from '@/firebase/firebaseConfig';
import { useAuth } from '@/src/auth/useAuth';
import { useLanguage } from '@/src/store/LanguageContext';
import { AppAlert } from '@/src/ui/AppAlert';
import { collection, onSnapshot, type Timestamp } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { acknowledgeHandbook } from './reliableWrites';
import { reliabilityCopy } from './reliabilityCopy';

type Ack = { caregiverUid: string; revision: string; acknowledgedAt?: Timestamp };
export function HandoverStatus({ patientId, revision, canAcknowledge = false }: {
  patientId: string; revision: string; canAcknowledge?: boolean;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = reliabilityCopy[language];
  const [rows, setRows] = useState<Ack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const scope = useRef('');
  const loadScope = `${patientId}/${revision}`;
  const [previousScope, setPreviousScope] = useState<string | null>(null);
  if (previousScope !== loadScope) {
    setPreviousScope(loadScope); setRows([]); setError(false); setLoading(Boolean(revision));
  }
  useEffect(() => {
    scope.current = `${patientId}/${revision}`;
    if (!revision) return;
    return onSnapshot(collection(db, 'patients', patientId, 'care_handbook', 'main', 'acknowledgments'),
      snap => { setRows(snap.docs.map(d => d.data() as Ack)); setLoading(false); setError(false); },
      () => { setRows([]); setError(true); setLoading(false); });
  }, [patientId, revision]);
  useEffect(() => () => { scope.current = ''; }, []);
  const current = rows.filter(row => row.revision === revision);
  const mine = current.some(row => row.caregiverUid === user?.uid);
  const acknowledge = async () => {
    if (!user || !revision || lock.current) return;
    lock.current = true; setSaving(true);
    const submittedScope = scope.current;
    try {
      await acknowledgeHandbook(db, patientId, user.uid, revision);
    } catch (e) {
      if (scope.current === submittedScope) AppAlert.alert(t.handover,
        (e as { code?: string }).code === 'care/conflict' ? t.changed : t.ackFailed);
    } finally { lock.current = false; setSaving(false); }
  };
  return <View style={styles.card}>
    <Text style={styles.heading}>{t.handover}</Text>
    {!revision ? <Text style={styles.text}>{t.legacy}</Text> : <>
      <Text selectable style={styles.small}>{t.version}: {revision}</Text>
      {loading ? <Text>{t.loading}</Text> : error ? <Text style={styles.error}>{t.ackFailed}</Text> : <>
        {current.length === 0 && <Text style={styles.text}>{t.pending}</Text>}
        {current.map(row => <View key={row.caregiverUid} style={styles.row}>
          <Text style={styles.text}>{t.acknowledged}</Text>
          <Text selectable style={styles.small}>{t.caregiver}: {row.caregiverUid}</Text>
          <Text style={styles.small}>{row.acknowledgedAt?.toDate().toLocaleString() ?? '—'}</Text>
        </View>)}
      </>}
      {canAcknowledge && !mine && <Pressable accessibilityRole="button" disabled={saving || loading || error}
        onPress={() => void acknowledge()} style={[styles.button, (saving || loading || error) && { opacity: 0.5 }]}>
        {saving ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{t.acknowledge}</Text>}
      </Pressable>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#E8F5F1', borderRadius: 14, padding: 16, gap: 10, marginVertical: 18 },
  heading: { fontSize: 20, fontWeight: '700', color: '#163B3C' },
  text: { fontSize: 16, lineHeight: 24, flexShrink: 1 },
  small: { fontSize: 13, lineHeight: 20, flexShrink: 1, color: '#475569' },
  row: { borderTopWidth: 1, borderColor: '#B8D9D0', paddingTop: 8 },
  error: { color: '#B42318' },
  button: { backgroundColor: '#18766D', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 17, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
});
