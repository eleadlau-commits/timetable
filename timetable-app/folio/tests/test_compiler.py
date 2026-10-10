"""Tests for the Folio compiler. Run with `python build.py test` (or `python -m unittest` in folio/tests)."""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(os.path.abspath(__file__)).parents[2]
sys.path.insert(0, str(ROOT / 'folio' / 'compiler'))

from folioc import Log, Project, deep_merge  # noqa: E402


def make_app(tmp: Path, features: dict) -> Path:
    """Creates app/app.json and one folder per feature: {id: feature.json dict, or (dict, {file: text})}."""
    app = tmp / 'app'
    (app / 'features').mkdir(parents=True)
    (app / 'app.json').write_text(json.dumps({'id': 'test-app', 'name': 'Test app'}), 'utf-8')
    for fid, spec in features.items():
        manifest, files = spec if isinstance(spec, tuple) else (spec, {})
        folder = app / 'features' / fid
        folder.mkdir()
        if manifest is not None:
            text = manifest if isinstance(manifest, str) else json.dumps(manifest)
            (folder / 'feature.json').write_text(text, 'utf-8')
        main = manifest.get('main', 'Main.js') if isinstance(manifest, dict) else 'Main.js'
        files.setdefault(main, "import { Feature } from 'folio';\nexport default class X extends Feature {}\n")
        for name, text in files.items():
            if text is None:  # a file that should be missing
                continue
            (folder / name).parent.mkdir(parents=True, exist_ok=True)
            (folder / name).write_text(text, 'utf-8')
    return app


def feature(**extra):
    return {'name': 'A feature', 'description': 'Does a thing.', 'main': 'Main.js', **extra}


class CompilerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix='folio-compiler-test-'))

    def resolve(self, features, without=()):
        project = Project(ROOT, make_app(self.tmp, features))
        found = project.discover(Log(quiet=True))
        included = project.resolve(found, without)
        return [f.id for f in included], {f.id: f for f in found}

    def test_features_start_after_what_they_require_and_use(self):
        order, _ = self.resolve({
            'views': feature(requires=['core'], uses=['extras']),
            'core': feature(),
            'extras': feature(requires=['core']),
        })
        self.assertEqual(order, ['core', 'extras', 'views'])

    def test_missing_requirement_leaves_the_feature_out(self):
        order, found = self.resolve({'notes': feature(requires=['sessions'])})
        self.assertEqual(order, [])
        self.assertIn('needs "sessions", which is not installed', found['notes'].reason)

    def test_leaving_out_spreads_to_features_that_need_it(self):
        order, found = self.resolve({
            'a': feature(requires=['b']),
            'b': feature(requires=['c']),
            'other': feature(),
        })
        self.assertEqual(order, ['other'])
        self.assertIn('"b"', found['a'].reason)

    def test_uses_is_optional(self):
        order, _ = self.resolve({'maps': feature(uses=['rooms'])})
        self.assertEqual(order, ['maps'])

    def test_requirements_in_a_circle_are_left_out(self):
        order, found = self.resolve({
            'a': feature(requires=['b']),
            'b': feature(requires=['a']),
            'c': feature(),
        })
        self.assertEqual(order, ['c'])
        self.assertIn('circle', found['a'].reason)

    def test_switched_off_and_left_out_features(self):
        order, found = self.resolve({'a': feature(enabled=False), 'b': feature(), 'c': feature()}, without=('c',))
        self.assertEqual(order, ['b'])
        self.assertEqual(found['a'].kind, 'off')
        self.assertEqual(found['c'].kind, 'off')

    def test_mistakes_in_feature_json(self):
        _, found = self.resolve({
            'broken-json': '{ "name": "x", }',
            'no-main': (feature(main='Missing.js'), {'Missing.js': None}),
            'bad-platform': feature(platforms=['windows']),
            'BadName': feature(),
        })
        self.assertIn('line 1', found['broken-json'].reason)
        self.assertIn('Missing.js', found['no-main'].reason)
        self.assertIn('platforms', found['bad-platform'].reason)
        self.assertIn('lowercase', found['BadName'].reason)

    def test_importing_another_features_files_is_not_allowed(self):
        _, found = self.resolve({
            'a': (feature(), {'Main.js': "import { x } from '../b/Main.js';\n"}),
            'b': feature(),
            'c': (feature(), {'Main.js': "import { y } from './helper.js';\n", 'helper.js': 'export const y = 1;\n'}),
        })
        self.assertIn('outside its own folder', found['a'].reason)
        self.assertEqual(found['c'].reason, '')

    def test_folder_without_feature_json_is_ignored(self):
        order, found = self.resolve({'notes': feature(), 'scratch': (None, {'Main.js': ''})})
        self.assertEqual(order, ['notes'])
        self.assertNotIn('scratch', found)

    def test_build_output(self):
        app = make_app(self.tmp, {
            'core': (feature(styles=['core.css'], templates='templates.html'), {
                'core.css': '.core { color: red; }',
                'templates.html': '<template id="setup"><p>Hi</p></template>',
                'README.md': 'not shipped',
                'tests/x.test.js': '// not shipped',
            }),
            'camera': feature(requires=['core'], native={
                'packages': {'@capacitor/camera': '^7.0.0'},
                'android': {'permissions': ['CAMERA']},
                'capacitor': {'server': {'allowNavigation': ['a.example']}},
            }),
            'web-only': feature(platforms=['web'], native={'android': {'permissions': ['INTERNET']}},
                                web={'manifest': {'share_target': {'action': './'}}}),
        })
        out = self.tmp / 'dist'
        code, details = Project(ROOT, app).build(out, Log(quiet=True), build_number='7')
        self.assertEqual(code, 0)
        web = out / 'web'
        index = (web / 'index.html').read_text('utf-8')
        self.assertIn('<template id="core--setup">', index)
        self.assertIn('"folio": "./folio/folio.js"', index)
        start = (web / 'start.js').read_text('utf-8')
        self.assertLess(start.index('"id": "core"'), start.index('"id": "camera"'))
        self.assertIn('"build": "7"', start)
        self.assertIn('.core { color: red; }', (web / 'app.css').read_text('utf-8'))
        self.assertFalse((web / 'features' / 'core' / 'README.md').exists())
        self.assertFalse((web / 'features' / 'core' / 'tests').exists())
        self.assertTrue((web / 'folio' / 'App.js').exists())
        self.assertFalse((web / 'folio' / 'testing.js').exists())
        self.assertIn("'test-app-", (web / 'sw.js').read_text('utf-8').replace('"', "'"))
        manifest = json.loads((web / 'manifest.webmanifest').read_text('utf-8'))
        self.assertEqual(manifest['share_target'], {'action': './'})
        package = json.loads((out / 'package.json').read_text('utf-8'))
        self.assertIn('@capacitor/camera', package['dependencies'])
        native = json.loads((out / 'native.json').read_text('utf-8'))
        self.assertEqual(native['android']['permissions'], ['CAMERA'])  # not INTERNET: web-only feature
        capacitor = json.loads((out / 'capacitor.config.json').read_text('utf-8'))
        self.assertEqual(capacitor['server']['allowNavigation'], ['a.example'])
        self.assertTrue((out / 'report.html').exists())

    def test_output_folder_with_other_files_is_not_emptied(self):
        app = make_app(self.tmp, {'core': feature()})
        out = self.tmp / 'precious'
        out.mkdir()
        (out / 'my-file.txt').write_text('keep me')
        code, _ = Project(ROOT, app).build(out, Log(quiet=True))
        self.assertEqual(code, 1)
        self.assertTrue((out / 'my-file.txt').exists())

    def test_deep_merge(self):
        base = {'a': {'b': 1, 'list': [1, 2]}, 'c': 1}
        deep_merge(base, {'a': {'d': 2, 'list': [2, 3]}, 'c': 5})
        self.assertEqual(base, {'a': {'b': 1, 'list': [1, 2, 3], 'd': 2}, 'c': 5})


if __name__ == '__main__':
    unittest.main()
