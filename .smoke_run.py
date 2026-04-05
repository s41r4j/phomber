import io
import contextlib
import phomber
def run_check(name, fn):
    output_buffer = io.StringIO()
    try:
        with contextlib.redirect_stdout(output_buffer):
            fn()
        output = output_buffer.getvalue()
        if name == 'number':
            fail_markers = [
                'Missing API key',
                'Invalid or unauthorized API key',
                'API rate limit reached',
                'Failed to fetch phone data from API',
                'Internet connection not available',
            ]
            status = 'FAIL' if any(marker in output for marker in fail_markers) else 'PASS'
        elif name == 'ip':
            fail_markers = [
                'Internet connection not available',
                'Invalid ip address format',
            ]
            status = 'FAIL' if any(marker in output for marker in fail_markers) else 'PASS'
        elif name == 'username':
            fail_markers = [
                'Internet connection not available',
                'Failed to load username source data',
            ]
            status = 'FAIL' if any(marker in output for marker in fail_markers) else 'PASS'
        else:
            status = 'FAIL'
    except Exception:
        status = 'FAIL'
    print(f'{name}: {status}')
run_check('number', lambda: phomber.number_lookup('+14155552671'))
run_check('ip', lambda: phomber.ip_lookup('8.8.8.8'))
run_check('username', lambda: phomber.username_lookup('torvalds'))
