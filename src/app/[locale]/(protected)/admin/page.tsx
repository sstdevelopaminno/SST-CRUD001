import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserManagementClient } from "@/components/admin/user-management-client";
import { getDictionaryByPath } from "@/lib/i18n/get-dictionary";
import { getUsers } from "@/services/admin.service";

export default async function AdminPage({ params }: { params: { locale: string } }) {
  const { dictionary } = await getDictionaryByPath(params.locale);
  const users = await getUsers();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dictionary.admin.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <UserManagementClient
          initialUsers={users}
          labels={{
            title: dictionary.admin.title,
            name: dictionary.admin.name,
            email: dictionary.admin.email,
            role: dictionary.admin.role,
            department: dictionary.admin.department,
            active: dictionary.admin.active,
            actions: dictionary.admin.actions,
            addUser: dictionary.admin.addUser,
            resetForm: dictionary.admin.resetForm,
            password: dictionary.admin.password,
            edit: dictionary.admin.edit,
            delete: dictionary.admin.delete,
            save: dictionary.admin.save,
            cancel: dictionary.admin.cancel,
            confirmDelete: dictionary.admin.confirmDelete,
            editTitle: dictionary.admin.editTitle,
            saveSuccess: dictionary.admin.saveSuccess,
            noDepartment: dictionary.admin.noDepartment,
            resetPassword: dictionary.admin.resetPassword,
            resetPasswordHint: dictionary.admin.resetPasswordHint,
            resetPasswordMinError: dictionary.admin.resetPasswordMinError,
            showPassword: dictionary.admin.showPassword,
            hidePassword: dictionary.admin.hidePassword,
            saveSuccessTitle: dictionary.admin.saveSuccessTitle,
            saveSuccessDescription: dictionary.admin.saveSuccessDescription,
            close: dictionary.admin.close,
            deleteTitle: dictionary.admin.deleteTitle,
            deleteDescription: dictionary.admin.deleteDescription,
            deleteConfirm: dictionary.admin.deleteConfirm,
          }}
        />
      </CardContent>
    </Card>
  );
}
