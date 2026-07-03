import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Attributes, overall } from '@eurobasqet/engine';
import { useGame } from '../../components/GameProvider';
import { Card, SectionTitle } from '../../components/ui';
import { theme } from '../../constants/theme';

const ATTR_LABELS: Record<keyof Attributes, string> = {
  shooting: 'Shooting',
  inside: 'Inside',
  playmaking: 'Playmaking',
  rebounding: 'Rebounding',
  defense: 'Defense',
  athleticism: 'Athleticism',
  stamina: 'Stamina',
  iq: 'Basketball IQ',
};

function AttrBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? theme.colors.win : value >= 65 ? theme.colors.accent : theme.colors.textDim;
  return (
    <View style={styles.attrRow}>
      <Text style={styles.attrLabel}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.attrValue}>{value}</Text>
    </View>
  );
}

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useGame();
  const player = id ? state.players[id] : undefined;

  if (!player) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.colors.textDim }}>Player not found.</Text>
      </View>
    );
  }

  const team = state.teams[player.teamId];
  const ovr = overall(player.attributes);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: theme.spacing(2) }}
    >
      <Card>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.name}>
              {player.firstName} {player.lastName}
            </Text>
            <Text style={styles.meta}>
              {player.position} · {player.age}y · {player.nationality}
              {team ? ` · ${team.name}` : ''}
            </Text>
          </View>
          <View style={styles.ovrBadge}>
            <Text style={styles.ovrValue}>{ovr}</Text>
            <Text style={styles.ovrLabel}>OVR</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaChip}>Potential {player.potential}</Text>
          <Text style={styles.metaChip}>Morale {player.morale}</Text>
          <Text style={styles.metaChip}>
            {player.contract.developmental ? 'Academy deal' : `Wage ${player.contract.wage}k`}
          </Text>
        </View>
      </Card>

      <Card>
        <SectionTitle>Attributes</SectionTitle>
        {(Object.keys(ATTR_LABELS) as (keyof Attributes)[]).map((key) => (
          <AttrBar key={key} label={ATTR_LABELS[key]} value={player.attributes[key]} />
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { color: theme.colors.text, fontSize: 24, fontWeight: '900' },
  meta: { color: theme.colors.textDim, fontSize: 13, marginTop: 4 },
  ovrBadge: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(0.75),
    alignItems: 'center',
  },
  ovrValue: { color: '#0B0E1A', fontWeight: '900', fontSize: 24 },
  ovrLabel: { color: '#0B0E1A', fontWeight: '800', fontSize: 10 },
  metaRow: { flexDirection: 'row', gap: theme.spacing(1), marginTop: theme.spacing(1.5), flexWrap: 'wrap' },
  metaChip: {
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: theme.spacing(1),
    paddingVertical: 4,
    fontSize: 12,
    overflow: 'hidden',
  },
  attrRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing(1) },
  attrLabel: { color: theme.colors.textDim, width: 96, fontSize: 13 },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 4,
    marginHorizontal: theme.spacing(1),
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4 },
  attrValue: { color: theme.colors.text, width: 28, textAlign: 'right', fontWeight: '700' },
});
