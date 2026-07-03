import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../components/GameProvider';
import { theme } from '../constants/theme';

export default function Schedule() {
  const { state } = useGame();
  const team = state.teams[state.userTeamId]!;

  // Only this club's fixtures, grouped by round.
  const mine = state.season.fixtures
    .filter((f) => f.homeTeamId === team.id || f.awayTeamId === team.id)
    .sort((a, b) => a.round - b.round);

  const sections = [
    { title: 'Played', data: mine.filter((f) => f.result) },
    { title: 'Upcoming', data: mine.filter((f) => !f.result) },
  ].filter((s) => s.data.length > 0);

  return (
    <SectionList
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: theme.spacing(2) }}
      sections={sections}
      keyExtractor={(f) => f.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={styles.section}>{section.title}</Text>
      )}
      renderItem={({ item: f }) => {
        const home = f.homeTeamId === team.id;
        const oppId = home ? f.awayTeamId : f.homeTeamId;
        const opp = state.teams[oppId]!;
        const r = f.result;
        let scoreText = home ? 'vs' : '@';
        let outcome: 'W' | 'L' | null = null;
        if (r) {
          const my = home ? r.homeScore : r.awayScore;
          const their = home ? r.awayScore : r.homeScore;
          outcome = my > their ? 'W' : 'L';
          scoreText = `${my}–${their}`;
        }
        return (
          <View style={styles.row}>
            <Text style={styles.round}>R{f.round}</Text>
            <Text style={styles.opp} numberOfLines={1}>
              {home ? 'vs' : '@'} {opp.name}
            </Text>
            {outcome ? (
              <View style={styles.result}>
                <Text
                  style={[
                    styles.badge,
                    { color: outcome === 'W' ? theme.colors.win : theme.colors.loss },
                  ]}
                >
                  {outcome}
                </Text>
                <Text style={styles.score}>{scoreText}</Text>
              </View>
            ) : (
              <Text style={styles.upcoming}>{scoreText === 'vs' ? 'Home' : 'Away'}</Text>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  section: {
    color: theme.colors.textDim,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
  },
  round: { color: theme.colors.textDim, fontWeight: '800', width: 44 },
  opp: { color: theme.colors.text, flex: 1, fontWeight: '600' },
  result: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  badge: { fontWeight: '900', fontSize: 16, width: 18, textAlign: 'center' },
  score: { color: theme.colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  upcoming: { color: theme.colors.textDim, fontStyle: 'italic' },
});
