import { describe, it, expect } from 'vitest';
import { TemplatePreprocessor } from './template-preprocessor';

describe('TemplatePreprocessor.tokenize', () => {
    it('splits simple body by whitespace', () => {
        const body = 'list nodes ordered="true"';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes', 'ordered="true"']);
    });

    it('trims leading/trailing whitespace', () => {
        const body = '   list   nodes   ';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes']);
    });

    it('collapses multiple spaces', () => {
        const body = 'list    nodes    extra=1';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes', 'extra=1']);
    });

    it('handles quoted extras as single tokens (basic)', () => {
        const body = 'list nodes ordered="true" property="name"';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes', 'ordered="true"', 'property="name"']);
    });

    it('handles brackets etc', () => {
        const body = 'list nodes["unique-id"].details ordered="true" property="name"';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes["unique-id"].details', 'ordered="true"', 'property="name"']);
    });

    it('handles brackets with spaces inside', () => {
        const body = 'list nodes["unique id"].details ordered="true" property="name"';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes["unique id"].details', 'ordered="true"', 'property="name"']);
    });

    it('handles single-quoted KV', () => {
        const body = 'list nodes ordered=\'true\' property=\'display name\'';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes', 'ordered=\'true\'', 'property=\'display name\'']);
    });

    it('keeps URL-ish unquoted values together', () => {
        const body = 'list nodes url=https://example.com/path?x=1&y=2';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes', 'url=https://example.com/path?x=1&y=2']);
    });

    it('supports numeric bracket indices and chained brackets', () => {
        const body = 'list nodes[0][1].details depth=2';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes[0][1].details', 'depth=2']);
    });

    it('supports consecutive bracketed string keys', () => {
        const body = 'list nodes[\'foo\'][\'bar baz\'][0]';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes[\'foo\'][\'bar baz\'][0]']);
    });

    it('handles chain starting with bracket', () => {
        const body = 'list ["root key"].child other=1';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', '["root key"].child', 'other=1']);
    });

    it('handles escaped quotes inside double-quoted KV', () => {
        const body = 'title="He said \\"hi\\"" kind=item';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['title="He said \\"hi\\""', 'kind=item']);
    });

    it('handles escaped quotes inside single-quoted KV', () => {
        const body = 'title=\'He said \\\'hi\\\'\' kind=item';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['title=\'He said \\\'hi\\\'\'', 'kind=item']);
    });

    it('keeps @root tokens together', () => {
        const body = '@root.nodes["id with space"]';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['@root.nodes["id with space"]']);
    });

    it('keeps dot-chains without brackets together', () => {
        const body = 'architecture.nodes.details';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['architecture.nodes.details']);
    });

    it('handles tabs and newlines as whitespace', () => {
        const body = 'list\tnodes\nordered="true"\tproperty="name"';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes', 'ordered="true"', 'property="name"']);
    });

    it('single KV only', () => {
        const body = 'ordered="true"';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['ordered="true"']);
    });

    it('multiple KVs with mixed quoting', () => {
        const body = 'a=1 b="two words" c=\'three words\' d=four';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['a=1', 'b="two words"', 'c=\'three words\'', 'd=four']);
    });

    it('handles parentheses as single token (no nesting)', () => {
        const body = '(alpha beta) gamma';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['(alpha beta)', 'gamma']);
    });

    it('KV with parens value without spaces is one token', () => {
        const body = 'expr=(a+b*c) next=1';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['expr=(a+b*c)', 'next=1']);
    });

    it('does not split on hyphens in identifiers', () => {
        const body = 'flow-sequence nodes[0].details flow-id="x"';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['flow-sequence', 'nodes[0].details', 'flow-id="x"']);
    });

    it('handles mixed bracket string and numeric index then dot', () => {
        const body = 'nodes[\'k v\'][2].child other="z"';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['nodes[\'k v\'][2].child', 'other="z"']);
    });

    it('handles trailing/leading heavy whitespace', () => {
        const body = '   list   nodes[0]   prop="x"   ';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['list', 'nodes[0]', 'prop="x"']);
    });

    it('keeps unknown symbols as part of tokens via fallback', () => {
        const body = '#weird token';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['#weird', 'token']);
    });

    it('KV with equals signs inside quoted value', () => {
        const body = 'filter="a==b && c!=d"';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['filter="a==b && c!=d"']);
    });

    it('handles bracket content with equals and quotes', () => {
        const body = 'nodes[\'id=="Upload Service"\' ].details';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['nodes[\'id=="Upload Service"\' ].details']);
    });

    it('chain with alternating bracket and dot segments', () => {
        const body = 'a[\'x y\'].b["c d"][0].e';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['a[\'x y\'].b["c d"][0].e']);
    });

    it('unquoted KV with punctuation in value stays single token', () => {
        const body = 'pattern=a*b+c?d';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['pattern=a*b+c?d']);
    });

    it('multiple chains and KVs together', () => {
        const body = 'list a.b["c d"][0] x.y z[1][\'q w\'] key="val 1" k2=\'v 2\' k3=v3';
        expect(TemplatePreprocessor.tokenize(body)).toEqual([
            'list',
            'a.b["c d"][0]',
            'x.y',
            'z[1][\'q w\']',
            'key="val 1"',
            'k2=\'v 2\'',
            'k3=v3',
        ]);
    });

    it('subexpression is a single token', () => {
        const body = '(eq elementType "Person")';
        expect(TemplatePreprocessor.tokenize(body)).toEqual(['(eq elementType "Person")']);
    });
});

describe('TemplatePreprocessor.interpretTokens', () => {
    it('1 token → standalone context path', () => {
        const t = TemplatePreprocessor.interpretTokens(['nodes']);
        expect(t).toEqual({ contextPath: 'nodes', impliedThis: false, isStandalonePath: true });
    });

    it('2 tokens → helper + context path', () => {
        const t = TemplatePreprocessor.interpretTokens(['list', 'nodes']);
        expect(t).toEqual({ helper: 'list', contextPath: 'nodes', impliedThis: false, isStandalonePath: false });
    });

    it('2 tokens with KV → helper + implied this + extras', () => {
        const t = TemplatePreprocessor.interpretTokens(['list', 'ordered="true"']);
        expect(t).toEqual({ helper: 'list', contextPath: 'this', extras: 'ordered="true"', impliedThis: true, isStandalonePath: false });
    });

    it('>2 tokens → helper + context path + extras', () => {
        const t = TemplatePreprocessor.interpretTokens(['list', 'nodes', 'ordered="true"', 'property="name"']);
        expect(t).toEqual({ helper: 'list', contextPath: 'nodes', extras: 'ordered="true" property="name"', impliedThis: false, isStandalonePath: false });
    });

    it('second token KV with more extras', () => {
        const t = TemplatePreprocessor.interpretTokens(['flow-sequence', 'flow-id="x"', 'property="y"']);
        expect(t).toEqual({ helper: 'flow-sequence', contextPath: 'this', extras: 'flow-id="x" property="y"', impliedThis: true, isStandalonePath: false });
    });

    it('does not mistake equals inside bracket path as KV', () => {
        const t = TemplatePreprocessor.interpretTokens(['list', 'nodes[\'id=="A"\']', 'ordered="true"']);
        expect(t).toEqual({ helper: 'list', contextPath: 'nodes[\'id=="A"\']', extras: 'ordered="true"', impliedThis: false, isStandalonePath: false });
    });

    it('explicit this as context still treated as context path', () => {
        const t = TemplatePreprocessor.interpretTokens(['flow-sequence', 'this', 'flow-id="x"']);
        expect(t).toEqual({ helper: 'flow-sequence', contextPath: 'this', extras: 'flow-id="x"', impliedThis: false, isStandalonePath: false });
    });

    it('helper + path + mixed extras', () => {
        const t = TemplatePreprocessor.interpretTokens(['join', 'a.b', '", "', 'limit=5']);
        expect(t).toEqual({
            helper: 'join',
            contextPath: 'a.b',
            extras: '", " limit=5',
            impliedThis: false,
            isStandalonePath: false
        });
    });
});

describe('TemplatePreprocessor.findMustacheSegments', () => {
    it('finds single simple segment', () => {
        const input = 'Hello {{user.name}}!';
        const segs = TemplatePreprocessor.findMustacheSegments(input);
        expect(segs.length).toBe(1);
        expect(segs[0].full).toBe('{{user.name}}');
        expect(segs[0].body).toBe('user.name');
        expect(segs[0].line).toBe(1);
        expect(segs[0].column).toBe(7);
        expect(input.slice(segs[0].start, segs[0].end)).toBe(segs[0].full);
    });

    it('finds multiple segments across lines', () => {
        const input = `
      {{list nodes['unique-id=="A"'] ordered="true"}}
      {{summary nodes["unique-id==\\"B\\""]}}
    `;
        const segs = TemplatePreprocessor.findMustacheSegments(input);
        expect(segs.length).toBe(2);
        expect(segs[0].body).toBe('list nodes[\'unique-id=="A"\'] ordered="true"');
        expect(segs[0].line).toBe(2);
        expect(segs[0].column).toBe(7);
        expect(segs[1].body).toBe('summary nodes["unique-id==\\"B\\""]');
        expect(segs[1].line).toBe(3);
        expect(segs[1].column).toBe(7);
    });

    it('includes control tags for now', () => {
        const input = `
      {{#each items}}
        {{this}}
      {{/each}}
    `;
        const segs = TemplatePreprocessor.findMustacheSegments(input);
        expect(segs.length).toBe(3);
        expect(segs.map(s => s.body.trim())).toEqual([
            '#each items',
            'this',
            '/each',
        ]);
        expect(segs[0].line).toBe(2);
        expect(segs[0].column).toBe(7);
        expect(segs[1].line).toBe(3);
        expect(segs[1].column).toBe(9);
        expect(segs[2].line).toBe(4);
        expect(segs[2].column).toBe(7);
    });

    it('captures indices correctly for slicing', () => {
        const input = 'a{{x}}b{{y.z}}c';
        const segs = TemplatePreprocessor.findMustacheSegments(input);
        expect(segs.length).toBe(2);
        const s0 = input.slice(segs[0].start, segs[0].end);
        const s1 = input.slice(segs[1].start, segs[1].end);
        expect(s0).toBe('{{x}}');
        expect(s1).toBe('{{y.z}}');
        expect(segs[0].line).toBe(1);
        expect(segs[0].column).toBe(2);
        expect(segs[1].line).toBe(1);
        expect(segs[1].column).toBe(8);
    });

    it('handles bracket filters and quotes', () => {
        const input = '{{nodes[\'id=="Upload Service"\'][0].details}}';
        const segs = TemplatePreprocessor.findMustacheSegments(input);
        expect(segs.length).toBe(1);
        expect(segs[0].body).toBe('nodes[\'id=="Upload Service"\'][0].details');
        expect(segs[0].line).toBe(1);
        expect(segs[0].column).toBe(1);
    });

    it('ignores braces outside mustache', () => {
        const input = '{{a}} { not } {{b.c}}';
        const segs = TemplatePreprocessor.findMustacheSegments(input);
        expect(segs.length).toBe(2);
        expect(segs[0].body).toBe('a');
        expect(segs[1].body).toBe('b.c');
        expect(segs[0].line).toBe(1);
        expect(segs[0].column).toBe(1);
        expect(segs[1].line).toBe(1);
        expect(segs[1].column).toBe(15);
    });
});

describe('TemplatePreprocessor.preprocessTemplate', () => {
    it('rewrites path with single quotes and extras', () => {
        const input = '{{list nodes[\'unique-id=="Upload Service"\'] ordered="true" property="name"}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe(
            '{{list (convertFromDotNotation this "nodes[\'unique-id==\\"Upload Service\\"\']" ordered="true" property="name") ordered="true" property="name"}}'
        );
    });

    it('rewrites path with single quotes and no extras', () => {
        const input = '{{list nodes[\'unique-id=="Upload Service"\']}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe('{{list (convertFromDotNotation this "nodes[\'unique-id==\\"Upload Service\\"\']")}}');
    });

    it('rewrites path with double quotes already present', () => {
        const input = '{{list nodes[unique-id=="Upload Service"]}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe('{{list (convertFromDotNotation this "nodes[unique-id==\\"Upload Service\\"]")}}');
    });

    it('leaves non-convertFromDotNotation able paths unchanged', () => {
        const input = '{{list nodes ordered="true"}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe('{{list nodes ordered="true"}}');
    });

    it('handles multiple occurrences in the same template', () => {
        const input = `
        {{list nodes['unique-id=="A"'] ordered="true"}}
        {{summary nodes['unique-id=="B"']}}
        `;
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toContain('{{list (convertFromDotNotation this "nodes[\'unique-id==\\"A\\"\']" ordered="true") ordered="true"}}');
        expect(output).toContain('{{summary (convertFromDotNotation this "nodes[\'unique-id==\\"B\\"\']")}}');
    });

    it('wraps nodes[...] without helper as convertFromDotNotation', () => {
        const input = '{{nodes[unique-id=="Upload Service"]}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{convertFromDotNotation this "nodes[unique-id==\\"Upload Service\\"]"}}');
    });

    it('wraps quoted nodes[...] without helper as convertFromDotNotation', () => {
        const input = '{{nodes[\'unique-id=="Upload Service"\']}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{convertFromDotNotation this "nodes[\'unique-id==\\"Upload Service\\"\']"}}');
    });

    it('wraps multiple bracket filters correctly', () => {
        const input = '{{relationships[\'type=="connect"\'][\'direction=="inbound"\']}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{convertFromDotNotation this "relationships[\'type==\\"connect\\"\'][\'direction==\\"inbound\\"\']"}}');
    });

    it('wraps deeply nested relationship path using bracket and dot notation', () => {
        const input = '{{list relationships[\'deployed-in-k8s-cluster\'][\'relationship-type\'][\'deployed-in\'].nodes ordered="true"}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);

        expect(output).toBe('{{list (convertFromDotNotation this "relationships[\'deployed-in-k8s-cluster\'][\'relationship-type\'][\'deployed-in\'].nodes" ordered="true") ordered="true"}}');
    });

    it('rewrites standalone dotted path', () => {
        const input = '{{a.b.c}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{a.b.c}}');
    });

    it('helper with explicit path gets wrapped, extras preserved', () => {
        const input = '{{join relationship-type.interacts.nodes ", "}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{join relationship-type.interacts.nodes ", "}}');
    });

    it('helper with implied this (second token is KV) adds explicit this', () => {
        const input = '{{flow-sequence flow-id="x" type="short"}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{flow-sequence this flow-id="x" type="short"}}');
    });

    it('widget helper with no arguments adds explicit this', () => {
        const input = '{{block-architecture}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{block-architecture this}}');
    });

    it('widget helper with only key-value arguments adds explicit this', () => {
        const input = '{{block-architecture focus-nodes="attendees"}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{block-architecture this focus-nodes="attendees"}}');
    });

    it('leaves reserved standalone paths', () => {
        expect(TemplatePreprocessor.preprocessTemplate('{{this}}')).toBe('{{this}}');
        expect(TemplatePreprocessor.preprocessTemplate('{{.}}')).toBe('{{.}}');
        expect(TemplatePreprocessor.preprocessTemplate('{{true}}')).toBe('{{true}}');
        expect(TemplatePreprocessor.preprocessTemplate('{{false}}')).toBe('{{false}}');
        expect(TemplatePreprocessor.preprocessTemplate('{{null}}')).toBe('{{null}}');
        expect(TemplatePreprocessor.preprocessTemplate('{{undefined}}')).toBe('{{undefined}}');
        expect(TemplatePreprocessor.preprocessTemplate('{{lookup}}')).toBe('{{lookup}}');
    });

    it('leaves relative paths unchanged', () => {
        expect(TemplatePreprocessor.preprocessTemplate('{{../unique-id}}')).toBe('{{../unique-id}}');
        expect(TemplatePreprocessor.preprocessTemplate('{{./name}}')).toBe('{{./name}}');
    });

    it('rewrites #each opener context path and preserves block params', () => {
        const input = '{{#each items as |i|}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{#each items as |i|}}');
    });

    it('block opener with dotted path gets wrapped and params kept', () => {
        const input = '{{#with a.b.c as |ctx|}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{#with a.b.c as |ctx|}}');
    });

    it('leaves #if with subexpression unchanged', () => {
        const input = '{{#if (eq elementType "Person")}}';
        const output = TemplatePreprocessor.preprocessTemplate(input);
        expect(output).toBe('{{#if (eq elementType "Person")}}');
    });

    it('control tags are untouched', () => {
        const src = [
            '{{/each}}',
            '{{! comment}}',
            '{{> partial}}',
            '{{^cond}}',
            '{{else}}'
        ].join('\n');
        const out = TemplatePreprocessor.preprocessTemplate(src);
        expect(out).toBe(src);
    });

    it('emits correct kinds across a small mixed template', () => {
        const src = `
{{#each nodes as |n|}}
- {{n.name}}
{{/each}}
{{lookup}}
{{flow-sequence flow-id="x"}}
{{a.b}}
`.trim();

        const decisions = TemplatePreprocessor.analyzeTemplate(src);
        // Expect 6 segments in order:
        // 0: #each nodes as |n|    -> leave
        // 1: n.name                -> leave
        // 2: /each                 -> control
        // 3: lookup                -> leave
        // 4: flow-sequence flow-id -> rewrite (implied this)
        // 5: a.b                   -> leave
        expect(decisions.length).toBe(6);

        expect(decisions[0].kind).toBe('leave');
        expect(decisions[1].kind).toBe('leave');
        expect(decisions[2].kind).toBe('control');
        expect(decisions[3].kind).toBe('leave');
        expect(decisions[4].kind).toBe('rewrite');
        expect(decisions[5].kind).toBe('leave');
    });

    it('subexpression standalone is left', () => {
        const src = '{{(eq a b)}}';
        const [d] = TemplatePreprocessor.analyzeTemplate(src);
        expect(d.kind).toBe('leave');
    });

    it('relative path standalone is left', () => {
        const src = '{{../x}}';
        const [d] = TemplatePreprocessor.analyzeTemplate(src);
        expect(d.kind).toBe('leave');
    });

    it('reserved context (not "this" or ".") inside helper is left', () => {
        const src = '{{list @index}}';
        const [d] = TemplatePreprocessor.analyzeTemplate(src);
        expect(d.kind).toBe('leave');
    });

    it('rewrites from right to left without corrupting indices', () => {
        const input = 'X {{a.b}} Y {{c.d.e}} Z {{list nodes ", "}}';
        const out = TemplatePreprocessor.preprocessTemplate(input);
        expect(out).toBe(
            'X {{a.b}} Y {{c.d.e}} Z {{list nodes ", "}}'
        );
    });

    it('leaves native Handlebars literal-segment paths unchanged in block helpers', () => {
        const input = `
      {{#with nodes.[0]}}
        {{unique-id}}
      {{/with}}
    `;
        const out = TemplatePreprocessor.preprocessTemplate(input);
        expect(out).toBe(
            `
      {{#with nodes.[0]}}
        {{unique-id}}
      {{/with}}
    `
        );
    });



    it('leaves helper with native path and no dot-notation hashes unchanged', () => {
        const input = '{{table nodes key="unique-id" columns="node-type, description"}}';
        const out = TemplatePreprocessor.preprocessTemplate(input);
        expect(out).toBe('{{table nodes key="unique-id" columns="node-type, description"}}');
    });

    it('rewrites helper when filter hash is present', () => {
        const input = '{{table nodes key="unique-id" columns="node-type, description" filter="node-type==\'database\'"}}';
        const out = TemplatePreprocessor.preprocessTemplate(input);
        expect(out).toBe(
            '{{table (convertFromDotNotation this "nodes" key="unique-id" columns="node-type, description" filter="node-type==\'database\'") key="unique-id" columns="node-type, description" filter="node-type==\'database\'"}}'
        );
    });

    it('rewrites helper when sort or limit hashes are present', () => {
        const input = '{{table nodes sort="name:asc" limit=10}}';
        const out = TemplatePreprocessor.preprocessTemplate(input);
        expect(out).toBe(
            '{{table (convertFromDotNotation this "nodes" sort="name:asc" limit=10) sort="name:asc" limit=10}}'
        );
    });



});
