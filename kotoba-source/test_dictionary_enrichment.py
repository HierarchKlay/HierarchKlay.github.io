"""Source-import safeguards; all fixtures are synthetic and self-contained."""
import bz2
import gzip
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from build_dictionary_enrichment import (
    morae, same_pronunciation, wiki_positions, kanjium_positions,
    build_pitch, build_examples,
)


class SourceImportTests(unittest.TestCase):
    def test_morae_and_equivalent_source_spelling(self):
        self.assertEqual(morae('キャット'), ['きゃ', 'っ', 'と'])
        self.assertEqual(morae('コンピューター'), ['こ', 'ん', 'ぴゅ', 'ー', 'た', 'ー'])
        self.assertTrue(same_pronunciation('えいご', 'えーご'))
        self.assertTrue(same_pronunciation('こうこう', 'こーこー'))
        self.assertFalse(same_pronunciation('おばさん', 'おばーさん'))
        self.assertFalse(same_pronunciation('こう', 'こーう'))

    def test_accent_conditions_and_uncertain_notation(self):
        self.assertEqual(kanjium_positions('(副)0,(名)3', 3),
                         [{'n': 0, 'label': '副'}, {'n': 3, 'label': '名'}])
        self.assertEqual(kanjium_positions('0,2', 2), [{'n': 0}, {'n': 2}])
        self.assertEqual(kanjium_positions('4', 3), [])
        for kana, tag, roman, n in [
            ('あめ', 'Atamadaka', '[áꜜmè]', 1),
            ('にほん', 'Nakadaka', '[nìhóꜜǹ]', 2),
            ('はし', 'Odaka', '[hàshíꜜ]', 2),
            ('がっこう', 'Heiban', '[gàkkóó]', 0),
            ('きょう', 'Atamadaka', '[kyóꜜò]', 1),
        ]:
            self.assertEqual(wiki_positions({'tags': [tag], 'roman': roman}, kana), [{'n': n}])
        self.assertEqual(wiki_positions({'tags': ['Heiban'], 'roman': '[nìhóꜜǹ]'}, 'にほん'), [])
        self.assertEqual(wiki_positions({'tags': ['Heiban'], 'roman': '[gàkkóó]'}, 'がこう'), [])
        self.assertEqual(wiki_positions({'tags': ['Heiban', 'Atamadaka'], 'roman': '[a báꜜ]'}, 'あば'), [])

    def test_heteronym_restrictions_and_ambiguous_targets(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'accents').write_text('下手\tへた\t0\n下手\tしもて\t0\n生\tなま\t1\n')
            (root / 'wiki').write_text('')
            entries = [
                {'id': '1', 'k': [{'t': '下手'}], 'r': [{'t': 'へた'}]},
                {'id': '2', 'k': [{'t': '下手'}, {'t': '他'}], 'r': [{'t': 'しもて', 'k': ['他']}]},
                {'id': '3', 'k': [{'t': '生'}], 'r': [{'t': 'なま'}]},
                {'id': '4', 'k': [{'t': '生'}], 'r': [{'t': 'なま'}]},
            ]
            result, stats = build_pitch(SimpleNamespace(kanjium=root / 'accents', wiktionary=root / 'wiki'), entries, [])
            self.assertEqual([x['id'] for x in result], ['1'])
            self.assertEqual(stats['unmatchedOrAmbiguousKanjium'], 2)

    def test_exact_sense_text_direct_links_and_authors(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            xml = '''<JMdict><!-- JMdict created: 2026-10-13 -->
              <entry><ent_seq>1</ent_seq><k_ele><keb>猫</keb></k_ele><r_ele><reb>ねこ</reb></r_ele>
              <sense><gloss>cat</gloss>
                <example><ex_srce exsrc_type="tat">10</ex_srce><ex_text>猫</ex_text><ex_sent xml:lang="jpn">猫がいる。</ex_sent><ex_sent xml:lang="eng">There is a cat.</ex_sent></example>
                <example><ex_srce exsrc_type="tat">40</ex_srce><ex_text>猫</ex_text><ex_sent xml:lang="jpn">猫だ。</ex_sent><ex_sent xml:lang="eng">A cat.</ex_sent></example>
              </sense></entry></JMdict>'''
            (root / 'jm.gz').write_bytes(gzip.compress(xml.encode()))
            files = {
                'jpn_sentences_detailed.tsv.bz2': '10\tjpn\t猫がいる。\tja_author\tdate\tdate\n40\tjpn\t原文已修改\tja_other\tdate\tdate\n',
                'eng_sentences_detailed.tsv.bz2': '20\teng\tThere is a cat.\ten_author\tdate\tdate\n50\teng\tA cat.\ten_other\tdate\tdate\n',
                'cmn_sentences_detailed.tsv.bz2': '30\tcmn\t有一只猫。\tzh_author\tdate\tdate\n60\tcmn\t未直接关联的译文\tother\tdate\tdate\n',
                'jpn-eng_links.tsv.bz2': '10\t20\n40\t50\n',
                'jpn-cmn_links.tsv.bz2': '10\t30\n99\t60\n',
            }
            for name, data in files.items():
                (root / name).write_bytes(bz2.compress(data.encode()))
            args = SimpleNamespace(jmdict_examples=root / 'jm.gz', tatoeba=root)
            entry = {'id': '1', 'k': [{'t': '猫'}], 'r': [{'t': 'ねこ'}], 's': [{'g': [{'t': 'cat'}]}]}
            result, stats, date = build_examples(args, [entry])
            self.assertEqual(date, '2026-10-13')
            self.assertEqual(stats['changedOrMissingJapanese'], 1)
            self.assertEqual(stats['examples'], 1)
            example = result[0]['s']['0'][0]
            self.assertEqual(example['j']['a'], 'ja_author')
            self.assertEqual(example['e']['a'], 'en_author')
            self.assertEqual(example['z'], [{'id': '30', 't': '有一只猫。', 'a': 'zh_author'}])
            # Identical English text does not override changed sense restrictions.
            entry['s'][0]['k'] = ['別']
            self.assertEqual(build_examples(args, [entry])[0], [])
            entry['s'][0].pop('k')
            # An unchanged English sentence without a direct link is rejected.
            (root / 'jpn-eng_links.tsv.bz2').write_bytes(bz2.compress(b''))
            self.assertEqual(build_examples(args, [entry])[0], [])


if __name__ == '__main__':
    unittest.main()
