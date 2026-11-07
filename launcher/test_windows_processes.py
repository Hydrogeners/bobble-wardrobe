from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from windows_processes import discord_running

class ProcessTests(unittest.TestCase):
    def test_matching_channel_blocks_writes(self):
        with patch('windows_processes.subprocess.run',return_value=SimpleNamespace(stdout='"Discord.exe","123","Console","1","10 K"\n')):
            with patch('windows_processes.image_path',return_value=Path(r'Z:\fixture\Discord\app-1.0.1\Discord.exe')):
                self.assertTrue(discord_running(Path(r'Z:\fixture\Discord')))
    def test_other_discord_copy_does_not_block_channel(self):
        with patch('windows_processes.subprocess.run',return_value=SimpleNamespace(stdout='"Discord.exe","123","Console","1","10 K"\n')):
            with patch('windows_processes.image_path',return_value=Path(r'Z:\OtherDiscord\app-1.0.1\Discord.exe')):
                self.assertFalse(discord_running(Path(r'Z:\fixture\Discord')))
    def test_unknown_process_fails_closed(self):
        with patch('windows_processes.subprocess.run',return_value=SimpleNamespace(stdout='"Discord.exe","123","Console","1","10 K"\n')):
            with patch('windows_processes.image_path',side_effect=OSError('access denied')):
                self.assertTrue(discord_running(Path(r'Z:\fixture\Discord')))
    def test_no_discord(self):
        with patch('windows_processes.subprocess.run',return_value=SimpleNamespace(stdout='INFO: No tasks match the specified criteria.')):
            self.assertFalse(discord_running(Path(r'Z:\fixture\Discord')))

if __name__=='__main__':unittest.main()
