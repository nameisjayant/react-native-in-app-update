import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useInAppUpdate } from '@nameisjayant/react-native-in-app-update';

/**
 * Real-app usage is a single line in your root component:
 *
 *   useInAppUpdate(); // mandatory: every user is forced onto the latest version
 *
 * This screen adds a mode switch and a status readout so you can watch the flow.
 * In-app updates only work when the app was installed from Google Play
 * (internal testing track or internal app sharing) — see README "Testing".
 */
export default function App() {
  const [mandatory, setMandatory] = useState(true);
  const { status, updateInfo, error, progress, checkNow, completeUpdate } =
    useInAppUpdate({ mandatory });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>In-app update</Text>

        <View style={styles.segment}>
          <Segment
            label="Mandatory"
            active={mandatory}
            onPress={() => setMandatory(true)}
          />
          <Segment
            label="Flexible"
            active={!mandatory}
            onPress={() => setMandatory(false)}
          />
        </View>
        <Text style={styles.hint}>
          {mandatory
            ? 'Full-screen Play update on every open/resume. Backing out shows it again.'
            : 'Downloads in the background; you choose when to restart.'}
        </Text>

        <View style={styles.card}>
          <Row label="Status" value={status} />
          <Row
            label="Availability"
            value={updateInfo?.updateAvailability ?? '—'}
          />
          <Row
            label="Available version code"
            value={updateInfo ? String(updateInfo.availableVersionCode) : '—'}
          />
          <Row
            label="Immediate / flexible allowed"
            value={
              updateInfo
                ? `${updateInfo.isImmediateAllowed} / ${updateInfo.isFlexibleAllowed}`
                : '—'
            }
          />
          <Row
            label="Staleness (days)"
            value={String(updateInfo?.clientVersionStalenessDays ?? '—')}
          />
          {status === 'downloading' && (
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
          )}
          {error && <Text style={styles.error}>{error.message}</Text>}
        </View>

        <Pressable
          style={styles.button}
          onPress={checkNow}
          disabled={status === 'checking' || status === 'prompting'}
        >
          {status === 'checking' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Check for update</Text>
          )}
        </Pressable>
      </ScrollView>

      {status === 'downloaded' && (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>An update has been downloaded</Text>
          <Pressable onPress={completeUpdate} hitSlop={12}>
            <Text style={styles.snackbarAction}>Reload</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Segment(props: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.segmentItem, props.active && styles.segmentActive]}
    >
      <Text
        style={[styles.segmentText, props.active && styles.segmentTextActive]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const GREEN = '#3c7a5f';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f7f9' },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1b1d21' },
  hint: { color: '#5b616b', fontSize: 14 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#e6e8ec',
    borderRadius: 12,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { color: '#5b616b', fontWeight: '600' },
  segmentTextActive: { color: '#1b1d21' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: '#5b616b', flexShrink: 1 },
  rowValue: { color: '#1b1d21', fontWeight: '600' },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d7e7df',
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: GREEN },
  error: { color: '#b3261e' },
  button: {
    backgroundColor: GREEN,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    backgroundColor: '#2b2d31',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  snackbarText: { color: '#fff', flexShrink: 1 },
  snackbarAction: { color: '#7fd1a6', fontWeight: '700' },
});
