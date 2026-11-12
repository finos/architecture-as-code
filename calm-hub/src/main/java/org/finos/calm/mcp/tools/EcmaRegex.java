package org.finos.calm.mcp.tools;

import com.google.re2j.PatternSyntaxException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Checks that a JSON Schema {@code pattern} is an ECMA-262 regular expression with the {@code u} flag,
 * as Ajv in the MCP TypeScript SDK compiles it. java.util.regex accepts syntax such as {@code (?i)},
 * possessive quantifiers and {@code \A} that ECMA-262 refuses. The check is strict: it can refuse a
 * rare valid pattern, but it must never accept one that a client cannot compile. The limits keep
 * the parsers of Hub, java.util.regex and the clients well inside their stacks.
 *
 * <p>The parser also writes the pattern in RE2 syntax, so that Hub can match caller input in linear
 * time. Lookarounds, back references and Unicode properties have no RE2 form with the same meaning.
 */
final class EcmaRegex {

    static final int MAX_LENGTH = 1000;
    static final int MAX_DEPTH = 64;
    // RE2J's time is the input length times the size of the compiled program, and nested repeats multiply
    // that size. Hub limits it before RE2J compiles, as RE2 C++ limits nested repeats.
    static final int MAX_EXPANDED_SIZE = 100;

    private static final String SYNTAX_CHARACTERS = "^$\\.*+?()[]{}|";
    private static final Set<String> GENERAL_CATEGORIES = Set.of("C", "Other", "Cc", "Control", "cntrl", "Cf", "Format",
            "Cn", "Unassigned", "Co", "Private_Use", "Cs", "Surrogate", "L", "Letter", "LC", "Cased_Letter", "Ll",
            "Lowercase_Letter", "Lm", "Modifier_Letter", "Lo", "Other_Letter", "Lt", "Titlecase_Letter", "Lu",
            "Uppercase_Letter", "M", "Mark", "Combining_Mark", "Mc", "Spacing_Mark", "Me", "Enclosing_Mark", "Mn",
            "Nonspacing_Mark", "N", "Number", "Nd", "Decimal_Number", "digit", "Nl", "Letter_Number", "No",
            "Other_Number", "P", "Punctuation", "punct", "Pc", "Connector_Punctuation", "Pd", "Dash_Punctuation", "Pe",
            "Close_Punctuation", "Pf", "Final_Punctuation", "Pi", "Initial_Punctuation", "Po", "Other_Punctuation", "Ps",
            "Open_Punctuation", "S", "Symbol", "Sc", "Currency_Symbol", "Sk", "Modifier_Symbol", "Sm", "Math_Symbol",
            "So", "Other_Symbol", "Z", "Separator", "Zl", "Line_Separator", "Zp", "Paragraph_Separator", "Zs",
            "Space_Separator");
    private static final Set<String> BINARY_PROPERTIES = Set.of("ASCII", "ASCII_Hex_Digit", "AHex", "Alphabetic",
            "Alpha", "Any", "Assigned", "Bidi_Control", "Bidi_C", "Bidi_Mirrored", "Bidi_M", "Case_Ignorable", "CI",
            "Cased", "Changes_When_Casefolded", "CWCF", "Changes_When_Casemapped", "CWCM", "Changes_When_Lowercased",
            "CWL", "Changes_When_NFKC_Casefolded", "CWKCF", "Changes_When_Titlecased", "CWT", "Changes_When_Uppercased",
            "CWU", "Dash", "Default_Ignorable_Code_Point", "DI", "Deprecated", "Dep", "Diacritic", "Dia", "Emoji",
            "Emoji_Component", "EComp", "Emoji_Modifier", "EMod", "Emoji_Modifier_Base", "EBase", "Emoji_Presentation",
            "EPres", "Extended_Pictographic", "ExtPict", "Extender", "Ext", "Grapheme_Base", "Gr_Base",
            "Grapheme_Extend", "Gr_Ext", "Hex_Digit", "Hex", "IDS_Binary_Operator", "IDSB", "IDS_Trinary_Operator",
            "IDST", "ID_Continue", "IDC", "ID_Start", "IDS", "Ideographic", "Ideo", "Join_Control", "Join_C",
            "Logical_Order_Exception", "LOE", "Lowercase", "Lower", "Math", "Noncharacter_Code_Point", "NChar",
            "Pattern_Syntax", "Pat_Syn", "Pattern_White_Space", "Pat_WS", "Quotation_Mark", "QMark", "Radical",
            "Regional_Indicator", "RI", "Sentence_Terminal", "STerm", "Soft_Dotted", "SD", "Terminal_Punctuation", "Term",
            "Unified_Ideograph", "UIdeo", "Uppercase", "Upper", "Variation_Selector", "VS", "White_Space", "space",
            "XID_Continue", "XIDC", "XID_Start", "XIDS");
    private static final Pattern SCRIPT_CODE = Pattern.compile("[A-Z][a-z]{3}");
    // ECMA-262 WhiteSpace and LineTerminator. RE2's \s has only ASCII spaces.
    private static final String SPACES = "\\x{9}-\\x{D}\\x{20}\\x{A0}\\x{1680}\\x{2000}-\\x{200A}\\x{2028}\\x{2029}"
            + "\\x{202F}\\x{205F}\\x{3000}\\x{FEFF}";
    private static final String ALL = "\\x{0}-\\x{10FFFF}";

    private final int[] chars;
    private int pos;
    private int groups;
    private int depth;
    private final Set<String> names = new HashSet<>();
    private final List<String> namedRefs = new ArrayList<>();
    private int maxRef;
    private final StringBuilder re2 = new StringBuilder();
    // The first reason that the pattern has no RE2 form with the same meaning.
    private String notLinear;
    // The RE2 form of the last class escape.
    private String classEscape;
    private long expandedSize;

    private EcmaRegex(String pattern) {
        chars = pattern.codePoints().toArray();
    }

    /** Null if the pattern compiles in ECMA-262 with the {@code u} flag, else the reason. */
    static String error(String pattern) {
        if (pattern.codePointCount(0, pattern.length()) > MAX_LENGTH) {
            return "it is longer than " + MAX_LENGTH + " characters";
        }
        try {
            new EcmaRegex(pattern).parse();
            return null;
        } catch (IllegalArgumentException e) {
            return e.getMessage();
        }
    }

    /** Null if {@link #linear} matches the pattern with its ECMA-262 meaning, else the reason. */
    static String linearError(String pattern) {
        String error = error(pattern);
        if (error != null) {
            return error;
        }
        EcmaRegex regex = new EcmaRegex(pattern);
        regex.parse();
        if (regex.notLinear != null) {
            return regex.notLinear + ", which CALM Hub cannot match in linear time";
        }
        if (regex.expandedSize > MAX_EXPANDED_SIZE) {
            return "its repeats expand it to more than " + MAX_EXPANDED_SIZE + " terms";
        }
        try {
            com.google.re2j.Pattern.compile(regex.re2.toString());
            return null;
        } catch (PatternSyntaxException e) {
            return "CALM Hub cannot match it in linear time: " + e.getDescription();
        }
    }

    /** The pattern compiled for RE2J. Call only if {@link #linearError} is null. */
    static com.google.re2j.Pattern linear(String pattern) {
        EcmaRegex regex = new EcmaRegex(pattern);
        regex.parse();
        return com.google.re2j.Pattern.compile(regex.re2.toString());
    }

    private void notLinear(String reason) {
        if (notLinear == null) {
            notLinear = reason;
        }
    }

    private void parse() {
        expandedSize = disjunction();
        if (!atEnd()) {
            throw fail("unmatched )");
        }
        if (maxRef > groups) {
            throw new IllegalArgumentException("the back reference \\" + maxRef + " names no group");
        }
        for (String name : namedRefs) {
            if (!names.contains(name)) {
                throw new IllegalArgumentException("the back reference \\k<" + name + "> names no group");
            }
        }
    }

    // The parse methods return the size of their part with each repeat expanded, at most MAX_EXPANDED_SIZE + 1.
    private long disjunction() {
        long size = alternative();
        while (peek() == '|') {
            pos++;
            re2.append('|');
            size = capped(size + alternative());
        }
        return size;
    }

    private long alternative() {
        long size = 0;
        while (!atEnd() && peek() != '|' && peek() != ')') {
            size = capped(size + term());
        }
        // RE2J compiles an empty alternative or group to an instruction too.
        return Math.max(size, 1);
    }

    private static long capped(long size) {
        return Math.min(size, MAX_EXPANDED_SIZE + 1L);
    }

    private long term() {
        int c = peek();
        if (c == '^' || c == '$') {
            // With no m flag, in both: only the start and the end of the text.
            re2.appendCodePoint(c);
            pos++;
            noQuantifier();
            return 1;
        } else if (c == '\\' && (peek(1) == 'b' || peek(1) == 'B')) {
            // ASCII word characters in both, with the u flag and no i flag.
            re2.append('\\').appendCodePoint(peek(1));
            pos += 2;
            noQuantifier();
            return 1;
        } else if (c == '(') {
            return group();
        }
        atom();
        return quantifier(1);
    }

    private long group() {
        if (++depth > MAX_DEPTH) {
            throw fail("groups are nested more than " + MAX_DEPTH + " deep");
        }
        if (startsWith("(?=") || startsWith("(?!") || startsWith("(?<=") || startsWith("(?<!")) {
            notLinear(peek(2) == '<' ? "it has a lookbehind" : "it has a lookahead");
            pos += peek(2) == '<' ? 4 : 3;
            disjunction();
            expect(')');
            depth--;
            noQuantifier();
            return 1;
        }
        if (startsWith("(?:")) {
            pos += 3;
        } else if (startsWith("(?<")) {
            pos += 3;
            String name = groupName();
            if (!names.add(name)) {
                throw fail("the group name '" + name + "' is used twice");
            }
            groups++;
        } else if (startsWith("(?")) {
            throw fail("(? must start (?:, (?=, (?!, (?<=, (?<! or (?<name>");
        } else {
            pos++;
            groups++;
        }
        // A match only tells if the text matches, so no group must capture.
        re2.append("(?:");
        long size = disjunction();
        expect(')');
        re2.append(')');
        depth--;
        return quantifier(size);
    }

    private void atom() {
        int c = peek();
        switch (c) {
            case '[' -> characterClass();
            case '\\' -> atomEscape();
            case '*', '+', '?', '{' -> throw fail("nothing to repeat");
            case ']', '}' -> throw fail("a lone " + (char) c + " must be escaped");
            case '.' -> {
                pos++;
                re2.append("[^\\n\\r\\x{2028}\\x{2029}]");
            }
            default -> literal(next(), false);
        }
    }

    private long quantifier(long size) {
        int start = pos;
        int c = peek();
        long copies = 1;
        if (c == '*' || c == '+' || c == '?') {
            pos++;
        } else if (c == '{') {
            copies = braces();
        } else {
            return size;
        }
        if (peek() == '?') {
            pos++;
        }
        if (isQuantifier(peek())) {
            throw fail("nothing to repeat (ECMA-262 has no possessive quantifiers)");
        }
        // Only ASCII digits, commas, braces and quantifier characters, which RE2 reads the same.
        for (int i = start; i < pos; i++) {
            re2.appendCodePoint(chars[i]);
        }
        return capped(size * Math.max(copies, 1));
    }

    // The number of copies of the term that RE2 compiles.
    private long braces() {
        int start = pos++;
        long min = digits();
        long max = min;
        if (peek() == ',') {
            pos++;
            max = peek() == '}' ? Long.MAX_VALUE : digits();
        }
        if (peek() != '}') {
            pos = start;
            throw fail("incomplete quantifier");
        }
        pos++;
        if (min > max) {
            pos = start;
            throw fail("the numbers of the quantifier are out of order");
        }
        return max == Long.MAX_VALUE ? min : max;
    }

    private long digits() {
        if (!isDigit(peek())) {
            throw fail("incomplete quantifier");
        }
        long value = 0;
        while (isDigit(peek())) {
            value = Math.min(value * 10 + (next() - '0'), Integer.MAX_VALUE);
        }
        return value;
    }

    private void noQuantifier() {
        if (isQuantifier(peek())) {
            throw fail("nothing to repeat");
        }
    }

    private void atomEscape() {
        pos++;
        int c = peek();
        if (c >= '1' && c <= '9') {
            notLinear("it has a back reference");
            long ref = digits();
            maxRef = (int) Math.max(maxRef, ref);
        } else if (c == 'k') {
            notLinear("it has a back reference");
            pos++;
            expect('<');
            namedRefs.add(groupName());
        } else {
            int value = escape(false);
            if (value >= 0) {
                literal(value, false);
            } else {
                re2.append(classEscape);
            }
        }
    }

    private void characterClass() {
        pos++;
        boolean negated = peek() == '^';
        if (negated) {
            pos++;
        }
        // RE2 has no empty class, so [] and [^] name all code points.
        if (peek() == ']') {
            pos++;
            re2.append(negated ? "[" : "[^").append(ALL).append(']');
            return;
        }
        re2.append(negated ? "[^" : "[");
        while (peek() != ']') {
            if (atEnd()) {
                throw fail("unterminated character class");
            }
            if (peek() == '&' && peek(1) == '&') {
                throw fail("&& in a character class is a Java intersection, not ECMA-262");
            }
            int from = classAtom();
            if (peek() == '-' && peek(1) != ']' && peek(1) != -1) {
                pos++;
                int to = classAtom();
                if (from < 0 || to < 0) {
                    throw fail("a class range cannot use a class escape");
                }
                if (from > to) {
                    throw fail("the class range is out of order");
                }
                literal(from, true);
                re2.append('-');
                literal(to, true);
            } else if (from >= 0) {
                literal(from, true);
            } else if (classEscape.startsWith("[")) {
                // \S: RE2 has no class in a class.
                notLinear("it has \\S in a character class");
            } else {
                re2.append(classEscape);
            }
        }
        pos++;
        re2.append(']');
    }

    // The code point, or -1 for a class escape such as \d.
    private int classAtom() {
        if (peek() == '\\') {
            pos++;
            int value = escape(true);
            if (value < 0 && classEscape.equals("[" + SPACES + "]")) {
                classEscape = SPACES;
            }
            return value;
        }
        return next();
    }

    private void literal(int c, boolean inClass) {
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || (!inClass && c == '-')) {
            re2.appendCodePoint(c);
        } else {
            re2.append("\\x{").append(Integer.toHexString(c)).append('}');
        }
    }

    // After the backslash. The code point, or -1 for a class escape.
    private int escape(boolean inClass) {
        if (atEnd()) {
            throw fail("\\ at the end of the pattern");
        }
        int start = pos - 1;
        int c = next();
        switch (c) {
            case 'd', 'D', 'w', 'W' -> {
                // ASCII in both, with the u flag and no i flag.
                classEscape = "\\" + (char) c;
                return -1;
            }
            case 's' -> {
                classEscape = "[" + SPACES + "]";
                return -1;
            }
            case 'S' -> {
                classEscape = "[^" + SPACES + "]";
                return -1;
            }
            case 'p', 'P' -> {
                property();
                classEscape = "\\pL";
                return -1;
            }
            case 'f' -> {
                return '\f';
            }
            case 'n' -> {
                return '\n';
            }
            case 'r' -> {
                return '\r';
            }
            case 't' -> {
                return '\t';
            }
            case 'v' -> {
                return 0x0B;
            }
            case 'c' -> {
                int letter = next();
                if (!((letter >= 'a' && letter <= 'z') || (letter >= 'A' && letter <= 'Z'))) {
                    throw failAt(start, "\\c must be followed by a letter");
                }
                return letter % 32;
            }
            case '0' -> {
                if (isDigit(peek())) {
                    throw failAt(start, "octal escapes are not ECMA-262");
                }
                return 0;
            }
            case 'x' -> {
                return hex(2, start);
            }
            case 'u' -> {
                return unicodeEscape(start);
            }
            default -> {
                if (SYNTAX_CHARACTERS.indexOf(c) >= 0 || c == '/' || (inClass && (c == '-' || c == 'b'))) {
                    return c == 'b' ? '\b' : c;
                }
                throw failAt(start, "\\" + Character.toString(c) + " is not an ECMA-262 escape");
            }
        }
    }

    private int unicodeEscape(int start) {
        if (peek() == '{') {
            pos++;
            int value = 0;
            int count = 0;
            while (isHex(peek())) {
                value = Math.min(value * 16 + Character.digit(next(), 16), 0x110000);
                count++;
            }
            if (count == 0 || peek() != '}' || value > 0x10FFFF) {
                throw failAt(start, "invalid \\u{...} escape");
            }
            pos++;
            return value;
        }
        int value = hex(4, start);
        if (Character.isHighSurrogate((char) value) && startsWith("\\u")) {
            int mark = pos;
            pos += 2;
            int low = isHex(peek()) ? hex(4, start) : -1;
            if (Character.isLowSurrogate((char) low)) {
                return Character.toCodePoint((char) value, (char) low);
            }
            pos = mark;
        }
        return value;
    }

    private int hex(int length, int start) {
        int value = 0;
        for (int i = 0; i < length; i++) {
            if (!isHex(peek())) {
                throw failAt(start, "invalid hexadecimal escape");
            }
            value = value * 16 + Character.digit(next(), 16);
        }
        return value;
    }

    private void property() {
        int start = pos - 2;
        if (peek() != '{') {
            throw failAt(start, "\\p and \\P must be followed by {");
        }
        pos++;
        StringBuilder sb = new StringBuilder();
        while (!atEnd() && peek() != '}') {
            sb.appendCodePoint(next());
        }
        if (atEnd()) {
            throw failAt(start, "unterminated \\p{");
        }
        pos++;
        String expression = sb.toString();
        int equals = expression.indexOf('=');
        boolean valid;
        if (equals < 0) {
            valid = GENERAL_CATEGORIES.contains(expression) || BINARY_PROPERTIES.contains(expression);
        } else {
            String name = expression.substring(0, equals);
            String value = expression.substring(equals + 1);
            valid = switch (name) {
                case "General_Category", "gc" -> GENERAL_CATEGORIES.contains(value);
                case "Script", "sc", "Script_Extensions", "scx" -> isScript(value);
                default -> false;
            };
        }
        if (!valid) {
            throw failAt(start, "\\p{" + expression + "} is not an ECMA-262 Unicode property");
        }
        // RE2J has the Unicode 6.0 tables, and ECMA-262 engines have Unicode 15 or later.
        notLinear("it has the Unicode property \\p{" + expression + "}");
    }

    // ECMA-262 names are case-sensitive: the Unicode name (Old_Italic) or the ISO 15924 code (Ital).
    private static boolean isScript(String value) {
        try {
            Character.UnicodeScript script = Character.UnicodeScript.forName(value);
            return value.equals(scriptName(script)) || SCRIPT_CODE.matcher(value).matches();
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static String scriptName(Character.UnicodeScript script) {
        if (script == Character.UnicodeScript.SIGNWRITING) {
            return "SignWriting";
        }
        StringBuilder sb = new StringBuilder();
        for (String part : script.name().split("_")) {
            if (!sb.isEmpty()) {
                sb.append('_');
            }
            sb.append(part.charAt(0)).append(part.substring(1).toLowerCase());
        }
        return sb.toString();
    }

    // After "(?<" or "\k<", up to and with the ">".
    private String groupName() {
        int start = pos;
        StringBuilder sb = new StringBuilder();
        int c = peek();
        if (!(c == '$' || c == '_' || Character.isUnicodeIdentifierStart(c))) {
            throw fail("invalid group name");
        }
        while (!atEnd() && peek() != '>') {
            c = next();
            if (!(c == '$' || c == 0x200C || c == 0x200D || Character.isUnicodeIdentifierPart(c))
                    || Character.isIdentifierIgnorable(c)) {
                throw failAt(start, "invalid group name");
            }
            sb.appendCodePoint(c);
        }
        expect('>');
        return sb.toString();
    }

    private void expect(int c) {
        if (peek() != c) {
            throw fail(atEnd() ? "missing " + (char) c : "expected " + (char) c);
        }
        pos++;
    }

    private boolean startsWith(String prefix) {
        for (int i = 0; i < prefix.length(); i++) {
            if (peek(i) != prefix.charAt(i)) {
                return false;
            }
        }
        return true;
    }

    private static boolean isQuantifier(int c) {
        return c == '*' || c == '+' || c == '?' || c == '{';
    }

    private static boolean isDigit(int c) {
        return c >= '0' && c <= '9';
    }

    private static boolean isHex(int c) {
        return c != -1 && Character.digit(c, 16) >= 0 && c < 128;
    }

    private boolean atEnd() {
        return pos >= chars.length;
    }

    private int peek() {
        return peek(0);
    }

    private int peek(int offset) {
        return pos + offset < chars.length ? chars[pos + offset] : -1;
    }

    private int next() {
        if (atEnd()) {
            throw fail("unexpected end of the pattern");
        }
        return chars[pos++];
    }

    private IllegalArgumentException fail(String reason) {
        return failAt(pos, reason);
    }

    private IllegalArgumentException failAt(int at, String reason) {
        return new IllegalArgumentException(reason + " (at character " + (at + 1) + ")");
    }
}
