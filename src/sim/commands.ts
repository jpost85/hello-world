// Input as discrete, tick-stamped commands (DESIGN.md §6.3). Even in single
// player everything goes through commands, so replays (seed + command stream)
// and future netplay are drop-in.

export interface MoveCommand {
  type: "move";
  tick: number; // tick this command should be applied on
  entityId: number;
  col: number;
  row: number;
}

export type Command = MoveCommand;
