import type { EnumOption, Option } from "./index";

/**
 * Primary options show up in the web UI in the "Language" settings tab,
 * Secondary options in "Other".
 * CLI is only for cli
 */
export type OptionKind = "primary" | "secondary" | "cli";
export type OptionType = "string" | "boolean" | "enum";

// This interface used to extend command-line-args' `OptionDefinition`, but
// that package is a dependency of the quicktype CLI, not of quicktype-core,
// so the type-only import leaked into the published declarations and broke
// consumers that compile with `skipLibCheck: false` (issue #2904).  The
// fields below that have no quicktype-specific meaning (`alias`, `group`,
// `defaultOption`, `lazyMultiple`, `type`) mirror the previously inherited
// fields of command-line-args' `OptionDefinition`, so option definitions
// remain directly consumable by `commandLineArgs` in the CLI.
export interface OptionDefinition<Name extends string = string, T = unknown> {
    /** Option Name */
    name: Name;
    /** Single-character CLI alias, e.g. `-o` for `--out` */
    alias?: string;
    /** Whether the CLI treats this option as the default positional argument */
    defaultOption?: boolean;
    /** CLI option group(s) this option belongs to */
    group?: string | string[];
    /** Whether repeated CLI values require repeating the option name */
    lazyMultiple?: boolean;
    /** Converts a CLI string input to the option's value type */
    type?: (input: string) => unknown;
    /** Option Description */
    description: string;
    /** Category of Option */
    optionType: OptionType;
    /** Default Value for Option */
    defaultValue?: T;
    /** Enum only, map of possible keys and values */
    values?: Record<string, unknown>;

    /** Primary, Secondary, or CLI */
    kind?: OptionKind;
    /** Whether multiple CLI inputs are allowed for this option */
    multiple?: boolean;

    // Unknown
    typeLabel?: string;
}

export type OptionName<O> = O extends Option<infer Name, unknown>
    ? Name
    : never;
export type OptionValue<O> = O extends EnumOption<
    string,
    infer EnumMap,
    infer EnumKey
>
    ? EnumMap[EnumKey]
    : O extends Option<string, infer Value>
      ? Value
      : never;

export type OptionKey<O> = O extends EnumOption<
    string,
    Record<string, unknown>,
    infer EnumKey
>
    ? EnumKey
    : O;

// FIXME: Merge these and use camelCase user-facing keys (v24)
export type OptionMap<T> = {
    [K in keyof T as OptionName<T[K]>]: OptionKey<T[K]>;
}; // user-facing, keys are `name` property of Option, values are the available input type
export type OptionValues<T> = { [K in keyof T]: OptionValue<T[K]> }; // internal, keys are keys of `_Options` object in each language file
