import { Link } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { overall } from '@eurobasqet/engine';
import { useGame } from '../components/GameProvider';
import { theme } from '../constants/theme';

export default function Roster() {
  const { state } = useGame();
  const team = state.teams[state.userTeamId]!;
  const roster = team.playerIds
    .map((id) => state.players[id]!)
    .sort((a, b) => overall(b.attributes) - overall(a.attributes));

  return (
    <FlatList
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: theme.spacing(2) }}
      data={roster}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <Text style={styles.header}>
          {team.name} · {roster.length} players
        </Text>
      }
      renderItem={({ item: p }) => {
        const ovr = overall(p.attributes);
        const potentialGap = p.potential - ovr;
        return (
          <Link href={`/player/${p.id}`} asChild>
            <View style={styles.row}>
              <View style={styles.pos}>
                <Text style={styles.posText}>{p.position}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {p.firstName} {p.lastName}
                </Text>
                <Text style={styles.meta}>
                  {p.nationality} · {p.age}y{potentialGap > 4 ? '  ↗ prospect' : ''}
                </Text>
              </View>
              <Text style={styles.ovr}>{ovr}</Text>
            </View>
          </Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: { color: theme.colors.textDim, fontWeight: '700', marginBottom: theme.spacing(1.5) },
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
  pos: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing(1.5),
  },
  posText: { color: theme.colors.accent, fontWeight: '800', fontSize: 13 },
  name: { color: theme.colors.text, fontWeight: '700', fontSize: 16 },
  meta: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  ovr: { color: theme.colors.text, fontWeight: '900', fontSize: 22, width: 40, textAlign: 'right' },
});
