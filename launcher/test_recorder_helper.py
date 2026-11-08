"""No network or real helper subprocesses; lifecycle belongs only to our child."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock,patch
from recorder_helper import RecorderHelper
from test_support import TEST_TEMP

class RecorderHelperTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(dir=TEST_TEMP);self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);(self.root/'recorder-tools').mkdir();(self.root/'recorder-tools/clip_host.cjs').write_text('// fixture')
        self.helper=RecorderHelper(self.root)
    def test_missing_node_keeps_recording_independent(self):
        with patch('recorder_helper.shutil.which',return_value=None):
            with self.assertRaisesRegex(RuntimeError,'Recording and saving work without Node'):self.helper.start()
        self.assertFalse(self.helper.running())
    def test_old_node_refused(self):
        with patch('recorder_helper.shutil.which',return_value='node'),patch('recorder_helper.subprocess.run',return_value=MagicMock(stdout='v20.1.0')):
            with self.assertRaisesRegex(RuntimeError,'22'):self.helper.start()
    def test_unknown_listener_not_killed(self):
        probe=MagicMock();probe.__enter__.return_value.bind.side_effect=OSError('busy')
        with patch('recorder_helper.shutil.which',return_value='node'),patch('recorder_helper.subprocess.run',return_value=MagicMock(stdout='v24.0.0')),patch('recorder_helper.socket.socket',return_value=probe),patch('recorder_helper.subprocess.Popen') as launch:
            with self.assertRaisesRegex(RuntimeError,'will not stop it'):self.helper.start()
            launch.assert_not_called()
    def test_explicit_start_stop_and_sanitized_environment(self):
        process=MagicMock();process.poll.return_value=None
        with patch('recorder_helper.shutil.which',return_value='node'),patch('recorder_helper.subprocess.run',return_value=MagicMock(stdout='v24.0.0')),patch('recorder_helper.socket.socket'),patch('recorder_helper.socket.create_connection'),patch('recorder_helper.subprocess.Popen',return_value=process) as launch,patch.dict('recorder_helper.os.environ',{'NODE_OPTIONS':'--require unwanted','NODE_PATH':'unwanted'}):
            self.assertIn('ready',self.helper.start());self.assertTrue(self.helper.running())
            args,kwargs=launch.call_args;self.assertEqual(args[0],['node',str(self.helper.script)])
            self.assertNotIn('NODE_OPTIONS',kwargs['env']);self.assertNotIn('NODE_PATH',kwargs['env']);self.assertFalse(kwargs.get('shell',False))
            self.assertIn('already running',self.helper.start());self.assertEqual(launch.call_count,1)
            self.helper.stop();process.terminate.assert_called_once();process.wait.assert_called_once();self.assertFalse(self.helper.running())
            self.helper.stop();process.terminate.assert_called_once()
    def test_missing_bundled_script(self):
        self.helper.script.unlink()
        with self.assertRaisesRegex(RuntimeError,'missing'):self.helper.start()

if __name__=='__main__':unittest.main()
