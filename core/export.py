import os
from datetime import datetime


def export_to_excel(df, output_path: str, project_name: str) -> str:
    """
    Export the DataFrame as an Excel file.
    """
    import pandas as pd

    os.makedirs(output_path, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    excel_path = os.path.join(output_path, f"{project_name}_{timestamp}.xlsx")
    df.to_excel(excel_path, index=False)
    return excel_path
