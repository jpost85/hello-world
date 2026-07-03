import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { overall, sortStandings, teamStrength, totalRounds } from '@eurobasqet/engine';
import { useGame } from '../components/GameProvider';
import { Button, Card, SectionTitle, StatPill } from '../components/ui';
import { theme } from '../constants/theme';

export default function Dashboard() {
  const { state, playNextRound, finishSeason, nextSeason } = useGame();
  const insets = useSafeAreaInsets();

  const team = state.teams[state.userTeamId]!;
  const roster = team.playerIds.map((id) => state.players[id]!);
  const division = state.pyramid.divisions.find((d) => d.teamIds.includes(team.id))!;
  const table = sortStandings(state.season.standings[division.id] ?? []);
  const rank = table.findIndex((r) => r.teamId === team.id) + 1;
  const record = table.find((r) => r.teamId === team.id);

  const played = state.season.fixtures.filter((f) => f.result).length;
  const total = state.season.fixtures.length;
  const roundsDone = new Set(
    state.season.fixtures.filter((f) => f.result).map((f) => f.round),
  ).size;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: insets.bottom + 24 }}
    >
      <Card>
        <SectionTitle>Your Club</SectionTitle>
        <Text style={styles.teamName}>{team.name}</Text>
        <Text style={styles.subtle}>
          {division.name} · Tier {team.tier} · {team.city}
        </Text>
        <View style={styles.pillRow}>
          <StatPill label="Rank" value={rank > 0 ? `#${rank}` : '–'} />
          <StatPill label="W–L" value={`${record?.won ?? 0}-${record?.lost ?? 0}`} />
          <StatPill label="Strength" value={teamStrength(roster).toFixed(0)} />
          <StatPill label="Budget" value={`${Math.round(team.finances.balance)}k`} />
        </View>
      </Card>

      <Card>
        <SectionTitle>Season {state.season.label}</SectionTitle>
        <Text style={styles.subtle}>
          {played}/{total} games played · round {Math.min(roundsDone + 1, totalRounds(state.season))}{' '}
          of {totalRounds(state.season)}
        </Text>
        <View style={[styles.pillRow, { marginTop: theme.spacing(1.5) }]}>
          {!state.season.completed ? (
            <>
              <Button label="Play round" onPress={playNextRound} />
              <Button label="Sim season" variant="ghost" onPress={finishSeason} />
            </>
          ) : (
            <Button label="Start next season →" onPress={nextSeason} />
          )}
        </View>
      </Card>

      <Card>
        <SectionTitle>Manage</SectionTitle>
        <View style={styles.linkRow}>
          <Link href="/roster" style={styles.link}>Roster</Link>
          <Link href="/standings" style={styles.link}>Standings</Link>
          <Link href="/schedule" style={styles.link}>Schedule</Link>
        </View>
      </Card>

      <Card>
        <SectionTitle>Squad Leaders</SectionTitle>
        {[...roster]
          .sort((a, b) => overall(b.attributes) - overall(a.attributes))
          .slice(0, 3)
          .map((p) => (
            <View key={p.id} style={styles.leaderRow}>
              <Text style={styles.leaderName}>
                {p.firstName} {p.lastName}
              </Text>
              <Text style={styles.subtle}>
                {p.position} · {p.age}y
              </Text>
              <Text style={styles.leaderOvr}>{overall(p.attributes)}</Text>
            </View>
          ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  teamName: { color: theme.colors.text, fontSize: 26, fontWeight: '900' },
  subtle: { color: theme.colors.textDim, fontSize: 13, marginTop: 2 },
  pillRow: {
    flexDirection: 'row',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  linkRow: { flexDirection: 'row', gap: theme.spacing(1.5), flexWrap: 'wrap' },
  link: {
    color: theme.colors.accent,
    fontWeight: '700',
    fontSize: 16,
    paddingVertical: 4,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(1),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  leaderName: { color: theme.colors.text, fontWeight: '700', flex: 1 },
  leaderOvr: { color: theme.colors.accent, fontWeight: '900', fontSize: 18, width: 36, textAlign: 'right' },
});
