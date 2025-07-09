import os
import gitlab
import argparse
import re
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

class GitlabPipelineFetcher:
    """Simple GitLab pipeline fetcher by ID"""

    def __init__(self):
        self.gl = gitlab.Gitlab(
            url=os.getenv('GITLAB_BASE_URL'),
            private_token=os.getenv('GITLAB_ACCESS_TOKEN')
        )
        self.gl.auth()
        self.project = self.gl.projects.get(os.getenv('PROJECT_ID'))

    def get_pipeline_by_id(self, pipeline_id):
        """Get pipeline by ID and display high-level info with jobs"""
        try:
            # Get pipeline
            pipeline = self.project.pipelines.get(pipeline_id)

            # Display pipeline info
            print(f"\nPipeline ID: {pipeline.id}")
            print(f"Status: {pipeline.status}")
            print(f"Ref: {pipeline.ref}")
            print(f"Created: {pipeline.created_at}")
            print(f"User: {pipeline.user['name'] if pipeline.user else 'N/A'}")

            # Get and display jobs
            jobs = pipeline.jobs.list(get_all=True)
            print(f"\nJobs ({len(jobs)}):")
            print("-" * 40)
            for job in jobs:
                print(f"{job.name} | {job.stage} | {job.status}")

            return pipeline
        except gitlab.exceptions.GitlabGetError:
            print(f"Pipeline {pipeline_id} not found")
            return None
        except Exception as e:
            print(f"Error: {e}")
            return None

    def extract_output_content(self, logs):
        """Extract only the OUTPUT CONTENT section from logs"""
        # Pattern to match the OUTPUT CONTENT section
        output_pattern = r'---------------------OUTPUT CONTENT----------------------------\n(.*?)\n---------------------END OF OUTPUT-----------------------------'

        match = re.search(output_pattern, logs, re.DOTALL)
        if match:
            return match.group(1).strip()
        else:
            return "No OUTPUT CONTENT section found"

    def get_script_output_only(self, pipeline_id, job_name=None):
        """Get and print ONLY the script output content (between OUTPUT CONTENT markers)"""
        try:
            pipeline = self.project.pipelines.get(pipeline_id)
            jobs = pipeline.jobs.list(get_all=True)

            print(f"\n📄 Script Output Content for Pipeline {pipeline_id}")
            print("=" * 60)

            for job in jobs:
                # If job_name specified, only get that job's output
                if job_name and job.name != job_name:
                    continue

                print(f"\n🔧 Job: {job.name} [{job.stage}] - {job.status}")
                print("-" * 50)

                try:
                    # Get full job object to access trace
                    full_job = self.project.jobs.get(job.id)
                    # Get job logs (script output)
                    logs = full_job.trace().decode('utf-8')

                    if logs:
                        # Extract only the OUTPUT CONTENT section
                        output_content = self.extract_output_content(logs)
                        print(output_content)
                    else:
                        print("No output available")

                except Exception as e:
                    print(f"Could not retrieve output: {e}")

                print("-" * 50)

            return True

        except gitlab.exceptions.GitlabGetError:
            print(f"Pipeline {pipeline_id} not found")
            return False
        except Exception as e:
            print(f"Error retrieving script output: {e}")
            return False

    def get_full_script_output(self, pipeline_id, job_name=None):
        """Get and print the full script output from pipeline jobs (original method)"""
        try:
            pipeline = self.project.pipelines.get(pipeline_id)
            jobs = pipeline.jobs.list(get_all=True)

            print(f"\n📄 Full Script Output for Pipeline {pipeline_id}")
            print("=" * 60)

            for job in jobs:
                # If job_name specified, only get that job's output
                if job_name and job.name != job_name:
                    continue

                print(f"\n🔧 Job: {job.name} [{job.stage}] - {job.status}")
                print("-" * 50)

                try:
                    # Get full job object to access trace
                    full_job = self.project.jobs.get(job.id)
                    # Get job logs (script output)
                    logs = full_job.trace().decode('utf-8')

                    if logs:
                        # Print the full logs
                        print(logs)
                    else:
                        print("No output available")

                except Exception as e:
                    print(f"Could not retrieve output: {e}")

                print("-" * 50)

            return True

        except gitlab.exceptions.GitlabGetError:
            print(f"Pipeline {pipeline_id} not found")
            return False
        except Exception as e:
            print(f"Error retrieving script output: {e}")
            return False

    def run(self, pipeline_id, output_only=False):
        """Run the script with command line argument pipeline_id"""
        self.get_pipeline_by_id(pipeline_id)

        if output_only:
            # Get only the OUTPUT CONTENT section
            self.get_script_output_only(pipeline_id, job_name="runscript_prod")
        else:
            # Get full script output (original behavior)
            self.get_full_script_output(pipeline_id, job_name="runscript_prod")

if __name__ == "__main__":
    """
    Example commands:
    python3 pipeline_fetcher.py --pipeline-id 12345                    # Full output (original)
    python3 pipeline_fetcher.py --pipeline-id 12345 --output-only      # Only OUTPUT CONTENT section
    """
    parser = argparse.ArgumentParser(description='GitLab pipeline fetcher')
    parser.add_argument('--pipeline-id', type=int, required=True, help='Pipeline ID')
    parser.add_argument('--output-only', action='store_true', help='Extract only the OUTPUT CONTENT section')

    args = parser.parse_args()

    fetcher = GitlabPipelineFetcher()
    fetcher.run(args.pipeline_id, output_only=args.output_only)