import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { orderedDivisions, sortStandings } from '@eurobasqet/engine';
import { useGame } from '../components/GameProvider';
import { theme } from '../constants/theme';

export default function Standings() {
  const { state } = useGame();
  const divisions = orderedDivisions(state.pyramid);
  const userDivIdx = divisions.findIndex((d) => d.teamIds.includes(state.userTeamId));
  const [tier, setTier] = useState(userDivIdx >= 0 ? userDivIdx : 0);
  const division = divisions[tier]!;
  const table = sortStandings(state.season.standings[division.id] ?? []);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: theme.spacing(2) }}
    >
      <View style={styles.tabs}>
        {divisions.map((d, i) => (
          <Pressable key={d.id} onPress={() => setTier(i)} style={[styles.tab, i === tier && styles.tabActive]}>
            <Text style={[styles.tabText, i === tier && styles.tabTextActive]}>T{d.tier}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.divName}>{division.name}</Text>

      <View style={[styles.row, styles.head]}>
        <Text style={[styles.cell, styles.rank]}>#</Text>
        <Text style={[styles.cell, styles.team]}>Team</Text>
        <Text style={styles.cell}>W</Text>
        <Text style={styles.cell}>L</Text>
        <Text style={[styles.cell, styles.pts]}>Pts</Text>
      </View>

      {table.map((r, i) => {
        const team = state.teams[r.teamId]!;
        const isUser = r.teamId === state.userTeamId;
        const promo = division.promotionSlots > 0 && i < division.promotionSlots;
        const releg =
          division.relegationSlots > 0 && i >= table.length - division.relegationSlots;
        return (
          <View key={r.teamId} style={[styles.row, isUser && styles.userRow]}>
            <View style={[styles.rank, styles.rankWrap]}>
              <View
                style={[
                  styles.marker,
                  promo && { backgroundColor: theme.colors.win },
                  releg && { backgroundColor: theme.colors.loss },
                ]}
              />
              <Text style={styles.cell}>{i + 1}</Text>
            </View>
            <Text style={[styles.cell, styles.team, isUser && styles.userText]} numberOfLines={1}>
              {team.name}
              {team.isReserve ? ' ⑂' : ''}
            </Text>
            <Text style={styles.cell}>{r.won}</Text>
            <Text style={styles.cell}>{r.lost}</Text>
            <Text style={[styles.cell, styles.pts]}>{r.leaguePoints}</Text>
          </View>
        );
      })}

      <Text style={styles.legend}>
        <Text style={{ color: theme.colors.win }}>■</Text> promotion ·{' '}
        <Text style={{ color: theme.colors.loss }}>■</Text> relegation · ⑂ reserve squad
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: theme.spacing(1), marginBottom: theme.spacing(1.5) },
  tab: {
    paddingVertical: theme.spacing(0.75),
    paddingHorizontal: theme.spacing(1.5),
    borderRadius: theme.radius,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  tabText: { color: theme.colors.textDim, fontWeight: '800' },
  tabTextActive: { color: '#0B0E1A' },
  divName: { color: theme.colors.text, fontSize: 18, fontWeight: '800', marginBottom: theme.spacing(1) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(1),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  head: { borderBottomWidth: 1 },
  userRow: { backgroundColor: theme.colors.surfaceAlt, borderRadius: 8 },
  cell: { color: theme.colors.text, width: 34, textAlign: 'center', fontVariant: ['tabular-nums'] },
  rank: { width: 44 },
  rankWrap: { flexDirection: 'row', alignItems: 'center' },
  marker: { width: 4, height: 18, borderRadius: 2, marginRight: 6, backgroundColor: 'transparent' },
  team: { flex: 1, textAlign: 'left', width: undefined },
  userText: { fontWeight: '900', color: theme.colors.accent },
  pts: { fontWeight: '800' },
  legend: { color: theme.colors.textDim, fontSize: 12, marginTop: theme.spacing(2) },
});
